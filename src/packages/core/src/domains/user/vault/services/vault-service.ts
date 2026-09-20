import { AUTH_ACR_AAL2 } from "@core/domains/auth/helpers";
import type { WebAuthnCredentialRepository } from "@core/domains/auth/repositories/webauthn-credential-repository";
import { DisplayName } from "@core/domains/user/entities/user/display-name";
import type { User } from "@core/domains/user/entities/user/index";
import type { UserRepository } from "@core/domains/user/repositories/user-repository";
import {
  isVaultSlotType,
  MAX_RECOVERY_PHRASE_SLOTS,
  VAULT_SLOT_TYPE_PASSWORD,
  VAULT_SLOT_TYPE_RECOVERY_PHRASE,
  VAULT_SLOT_TYPE_WEBAUTHN_PRF,
} from "@core/domains/user/vault/constants";
import { VaultSlot } from "@core/domains/user/vault/entities/vault-slot";
import type { VaultSlotRepository } from "@core/domains/user/vault/repositories/vault-slot-repository";
import type {
  VaultPublicState,
  VaultSlotInput,
  VaultSlotPublic,
  VaultSlotUpdateInput,
} from "@core/domains/user/vault/types";
import type { PasswordHasher } from "@core/ports/auth";
import {
  BusinessRuleError,
  ConflictError,
  EntityNotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@core/shared/errors/domain-error";
import { findFirst } from "@core/shared/query";

function toPublicSlot(slot: VaultSlot): VaultSlotPublic {
  return {
    id: slot.id,
    slotType: slot.slotType,
    salt: slot.salt,
    wrapBlob: slot.wrapBlob,
    credentialId: slot.credentialId ? VaultSlot.encodeCredentialId(slot.credentialId) : null,
    label: slot.label,
  };
}

export class VaultService {
  constructor(
    private readonly users: UserRepository,
    private readonly vaultSlots: VaultSlotRepository,
    private readonly webauthnCredentials: WebAuthnCredentialRepository,
    private readonly password: PasswordHasher
  ) {}

  async get(userId: string): Promise<VaultPublicState> {
    const user = await this._get(userId);
    const slots = await this.vaultSlots.findByFilters({ userId: user.id });

    return {
      vaultInitialized: slots.length > 0,
      vaultSlots: slots.map(toPublicSlot),
      displayName: user.displayName?.toString() ?? null,
    };
  }

  async initialize(
    userId: string,
    authAcr: string,
    slots: VaultSlotInput[],
    displayName?: string | null
  ): Promise<VaultSlotPublic[]> {
    const user = await this._get(userId);

    if (slots.length === 0) {
      throw new ValidationError("At least one vault slot is required.");
    }

    const existingCount = await this.vaultSlots.aggregate({ userId: user.id });
    if (existingCount > 0) {
      throw new ConflictError("Vault is already initialized.");
    }

    const name = DisplayName.parseOptional(displayName);

    const existing: VaultSlot[] = [];
    const pending: VaultSlot[] = [];
    const now = new Date();

    for (const input of slots) {
      await this._authorizeSlotMutation(
        user,
        authAcr,
        input.slotType,
        existing,
        input.password,
        true
      );
      const slot = await this._validateSlotInput(user.id, input, existing, now);
      pending.push(slot);
      existing.push(slot);
    }

    const created = await this.vaultSlots.create(pending);
    const createdSlots = Array.isArray(created) ? created : [created];
    if (name !== null) {
      await this.users.save(user.withDisplayName(name));
    }

    return createdSlots.map(toPublicSlot);
  }

  async create(userId: string, authAcr: string, input: VaultSlotInput): Promise<VaultSlotPublic> {
    const user = await this._get(userId);
    const existing = await this.vaultSlots.findByFilters({ userId: user.id });

    if (existing.length === 0) {
      throw new BusinessRuleError(
        "Initialize the vault before adding a key.",
        "VAULT_NOT_INITIALIZED"
      );
    }

    await this._authorizeSlotMutation(
      user,
      authAcr,
      input.slotType,
      existing,
      input.password,
      false
    );
    const slot = await this._validateSlotInput(user.id, input, existing, new Date());
    const created = await this.vaultSlots.create(slot);
    const createdSlot = Array.isArray(created) ? created[0] : created;
    if (!createdSlot) {
      throw new ValidationError("Vault slot could not be created.");
    }

    return toPublicSlot(createdSlot);
  }

  async rotateWrap(
    userId: string,
    authAcr: string,
    slotId: string,
    input: VaultSlotUpdateInput
  ): Promise<VaultSlotPublic> {
    const user = await this._get(userId);
    const slot = await this._getOwnedSlot(user.id, slotId);
    const existing = await this.vaultSlots.findByFilters({ userId: user.id });

    await this._authorizeSlotMutation(
      user,
      authAcr,
      slot.slotType,
      existing,
      input.password,
      false
    );

    const updatedAt = new Date();
    const updated = slot.withWrap(input.salt, input.wrapBlob, updatedAt);

    const [saved] = await this.vaultSlots.update(
      { id: slot.id },
      {
        salt: updated.salt,
        wrapBlob: updated.wrapBlob,
        updatedAt,
      }
    );
    if (!saved) {
      throw new EntityNotFoundError("VaultSlot", slot.id);
    }

    return toPublicSlot(saved);
  }

  async replaceFromBackup(
    userId: string,
    slots: Array<{
      slotType: string;
      salt: string;
      wrapBlob: string;
      label?: string | null;
      credentialId?: string | null;
    }>
  ): Promise<{ imported: number; skippedPrf: number }> {
    await this._get(userId);
    const now = new Date();
    const pending: VaultSlot[] = [];
    let skippedPrf = 0;
    const limits = { phraseCount: 0, hasPassword: false };

    for (const input of slots) {
      if (input.slotType === VAULT_SLOT_TYPE_WEBAUTHN_PRF) {
        const prf = await this.tryImportPrfSlot(userId, input, pending, now);
        if (prf.skipped) {
          skippedPrf += 1;
        }
        continue;
      }
      const slot = await this.importStandardBackupSlot(userId, input, pending, now, limits);
      pending.push(slot);
    }

    if (pending.length === 0) {
      throw new ValidationError("Backup has no usable vault slots.");
    }

    await this.vaultSlots.delete({ userId });
    await this.vaultSlots.create(pending);
    return { imported: pending.length, skippedPrf };
  }

  private async tryImportPrfSlot(
    userId: string,
    input: {
      salt: string;
      wrapBlob: string;
      label?: string | null;
      credentialId?: string | null;
    },
    pending: VaultSlot[],
    now: Date
  ): Promise<{ skipped: boolean }> {
    try {
      const slot = await this._validateSlotInput(
        userId,
        {
          slotType: VAULT_SLOT_TYPE_WEBAUTHN_PRF,
          salt: input.salt,
          wrapBlob: input.wrapBlob,
          label: input.label ?? undefined,
          credentialId: input.credentialId ?? undefined,
        },
        pending,
        now
      );
      pending.push(slot);
      return { skipped: false };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        return { skipped: true };
      }
      throw error;
    }
  }

  private async importStandardBackupSlot(
    userId: string,
    input: {
      slotType: string;
      salt: string;
      wrapBlob: string;
      label?: string | null;
      credentialId?: string | null;
    },
    pending: VaultSlot[],
    now: Date,
    limits: { phraseCount: number; hasPassword: boolean }
  ): Promise<VaultSlot> {
    if (input.slotType === VAULT_SLOT_TYPE_PASSWORD && limits.hasPassword) {
      throw new ValidationError("Backup contains duplicate password slots.");
    }
    if (input.slotType === VAULT_SLOT_TYPE_RECOVERY_PHRASE) {
      if (limits.phraseCount >= MAX_RECOVERY_PHRASE_SLOTS) {
        throw new ValidationError("Backup has too many recovery phrase slots.");
      }
      limits.phraseCount += 1;
    }
    if (!isVaultSlotType(input.slotType)) {
      throw new ValidationError("Vault slot type is invalid.");
    }
    const slot = await this._validateSlotInput(
      userId,
      {
        slotType: input.slotType,
        salt: input.salt,
        wrapBlob: input.wrapBlob,
        label: input.label ?? undefined,
        credentialId: input.credentialId ?? undefined,
      },
      pending,
      now
    );
    if (slot.slotType === VAULT_SLOT_TYPE_PASSWORD) {
      limits.hasPassword = true;
    }
    return slot;
  }

  async delete(userId: string, authAcr: string, slotId: string, password?: string): Promise<void> {
    const user = await this._get(userId);
    const existing = await this.vaultSlots.findByFilters({ userId: user.id });

    if (existing.length <= 1) {
      throw new BusinessRuleError("At least one decryption key is required.", "VAULT_LAST_SLOT");
    }

    const slot = await this._getOwnedSlot(user.id, slotId);

    if (!(await this._authorizeDelete(user, authAcr, existing, password))) {
      throw new UnauthorizedError("Vault slot change is not authorized.");
    }

    await this.vaultSlots.delete({ id: slot.id });
  }

  async canDeleteCredential(userId: string, credentialId: Buffer): Promise<boolean> {
    const slot = await findFirst(this.vaultSlots.findByFilters.bind(this.vaultSlots), {
      userId,
      credentialId,
    });
    if (!slot) {
      return false;
    }

    const count = await this.vaultSlots.aggregate({ userId });
    if (count <= 1) {
      throw new BusinessRuleError("At least one decryption key is required.", "VAULT_LAST_KEY");
    }

    return true;
  }

  async deleteCredential(userId: string, credentialId: Buffer): Promise<void> {
    await this.vaultSlots.delete({ userId, credentialId });
  }

  async list(userId: string): Promise<VaultSlot[]> {
    return this.vaultSlots.findByFilters({ userId });
  }

  async hasRecoverySlot(userId: string): Promise<boolean> {
    const slots = await this.vaultSlots.findByFilters({ userId });
    return VaultService.vaultRecoveryMethods(slots).length > 0;
  }

  static vaultRecoveryMethods(slots: readonly { slotType: string }[]): string[] {
    const methods: string[] = [];
    let hasPhrase = false;
    let hasPrf = false;

    for (const slot of slots) {
      if (slot.slotType === VAULT_SLOT_TYPE_RECOVERY_PHRASE) {
        hasPhrase = true;
      }
      if (slot.slotType === VAULT_SLOT_TYPE_WEBAUTHN_PRF) {
        hasPrf = true;
      }
    }

    if (hasPhrase) {
      methods.push(VAULT_SLOT_TYPE_RECOVERY_PHRASE);
    }
    if (hasPrf) {
      methods.push(VAULT_SLOT_TYPE_WEBAUTHN_PRF);
    }

    return methods;
  }

  async upsertPassword(userId: string, salt: string, wrapBlob: string): Promise<void> {
    const slots = await this.vaultSlots.findByFilters({ userId });
    const existing = slots.find((slot) => slot.slotType === VAULT_SLOT_TYPE_PASSWORD);
    const now = new Date();

    if (existing) {
      const updated = existing.withWrap(salt, wrapBlob, now);
      await this.vaultSlots.update(
        { id: existing.id },
        { salt: updated.salt, wrapBlob: updated.wrapBlob, updatedAt: now }
      );
      return;
    }

    await this.vaultSlots.create(
      VaultSlot.create({
        userId,
        slotType: VAULT_SLOT_TYPE_PASSWORD,
        salt,
        wrapBlob,
        label: "",
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  filterPrf<T extends { credentialId: Buffer }>(
    slots: readonly { slotType: string; credentialId: Buffer | null }[],
    credentials: T[]
  ): T[] {
    const prfIds = new Set<string>();
    for (const slot of slots) {
      if (slot.slotType === VAULT_SLOT_TYPE_WEBAUTHN_PRF && slot.credentialId !== null) {
        prfIds.add(slot.credentialId.toString("hex"));
      }
    }

    return credentials.filter((credential) => prfIds.has(credential.credentialId.toString("hex")));
  }

  matchesPrfCredential(
    slots: readonly { slotType: string; credentialId: Buffer | null }[],
    credentialId: Buffer
  ): boolean {
    return slots.some(
      (slot) =>
        slot.slotType === VAULT_SLOT_TYPE_WEBAUTHN_PRF &&
        slot.credentialId !== null &&
        slot.credentialId.equals(credentialId)
    );
  }

  private async _validateSlotInput(
    userId: string,
    input: VaultSlotInput,
    existing: VaultSlot[],
    now: Date
  ): Promise<VaultSlot> {
    const slotType = input.slotType.trim();
    let credentialId: Buffer | null = null;

    switch (slotType) {
      case VAULT_SLOT_TYPE_PASSWORD:
        if (existing.some((slot) => slot.slotType === VAULT_SLOT_TYPE_PASSWORD)) {
          throw new ConflictError("That vault slot already exists.");
        }
        break;
      case VAULT_SLOT_TYPE_RECOVERY_PHRASE: {
        const count = existing.filter(
          (slot) => slot.slotType === VAULT_SLOT_TYPE_RECOVERY_PHRASE
        ).length;
        if (count >= MAX_RECOVERY_PHRASE_SLOTS) {
          throw new ConflictError("That vault slot already exists.");
        }
        break;
      }
      case VAULT_SLOT_TYPE_WEBAUTHN_PRF: {
        if (!input.credentialId || input.credentialId.trim().length === 0) {
          throw new ValidationError("Credential id is required.", { field: "credentialId" });
        }

        const raw = VaultSlot.parseCredentialId(input.credentialId);
        const credential = await findFirst(
          this.webauthnCredentials.findByFilters.bind(this.webauthnCredentials),
          { credentialId: raw }
        );
        if (!credential || credential.userId !== userId) {
          throw new ValidationError("Credential was not found.", { field: "credentialId" });
        }

        if (
          existing.some(
            (slot) =>
              slot.slotType === VAULT_SLOT_TYPE_WEBAUTHN_PRF &&
              slot.credentialId !== null &&
              slot.credentialId.equals(raw)
          )
        ) {
          throw new ConflictError("That vault slot already exists.");
        }

        credentialId = raw;
        break;
      }
    }

    return VaultSlot.create({
      userId,
      slotType: input.slotType,
      salt: input.salt,
      wrapBlob: input.wrapBlob,
      label: input.label,
      credentialId,
      createdAt: now,
      updatedAt: now,
    });
  }

  private async _authorizeSlotMutation(
    user: User,
    authAcr: string,
    targetType: string,
    existing: VaultSlot[],
    password?: string,
    isInitialize = false
  ): Promise<void> {
    if (
      !(await this._isAuthorizedForMutation(
        user,
        authAcr,
        targetType,
        existing,
        password,
        isInitialize
      ))
    ) {
      throw new UnauthorizedError("Vault slot change is not authorized.");
    }
  }

  private async _isAuthorizedForMutation(
    user: User,
    authAcr: string,
    targetType: string,
    existing: VaultSlot[],
    password?: string,
    isInitialize = false
  ): Promise<boolean> {
    if (targetType === VAULT_SLOT_TYPE_PASSWORD) {
      if (await this._verifyPasswordProof(user, password)) {
        return true;
      }

      return !user.multifactorEnabled;
    }

    if (user.multifactorEnabled && authAcr !== AUTH_ACR_AAL2) {
      return false;
    }

    if (await this._verifyPasswordProof(user, password)) {
      return true;
    }

    if (isInitialize && targetType === VAULT_SLOT_TYPE_RECOVERY_PHRASE) {
      return true;
    }

    if (
      (targetType === VAULT_SLOT_TYPE_RECOVERY_PHRASE ||
        targetType === VAULT_SLOT_TYPE_WEBAUTHN_PRF) &&
      (this._hasUnlockSlot(existing) || isInitialize)
    ) {
      return true;
    }

    return false;
  }

  private async _authorizeDelete(
    user: User,
    authAcr: string,
    existing: VaultSlot[],
    password?: string
  ): Promise<boolean> {
    if (await this._verifyPasswordProof(user, password)) {
      return true;
    }

    if (user.multifactorEnabled && authAcr !== AUTH_ACR_AAL2) {
      return false;
    }

    return this._hasUnlockSlot(existing);
  }

  private async _verifyPasswordProof(user: User, password?: string): Promise<boolean> {
    if (!password || password.length === 0) {
      return false;
    }

    return this.password.verify(password, user.passwordHash);
  }

  private _hasUnlockSlot(slots: VaultSlot[]): boolean {
    return slots.some(
      (slot) =>
        slot.slotType === VAULT_SLOT_TYPE_PASSWORD || slot.slotType === VAULT_SLOT_TYPE_WEBAUTHN_PRF
    );
  }

  private async _get(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedError("Session is invalid or expired.");
    }

    return user;
  }

  private async _getOwnedSlot(userId: string, slotId: string): Promise<VaultSlot> {
    const slot = await this.vaultSlots.findById(slotId);
    if (!slot || slot.userId !== userId) {
      throw new EntityNotFoundError("VaultSlot", slotId);
    }

    return slot;
  }
}
