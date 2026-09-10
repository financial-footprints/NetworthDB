import { verifyPassword } from "@core/domains/auth/embedded/password";
import { AUTH_ACR_AAL2 } from "@core/domains/auth/helpers";
import type { WebAuthnCredentialRepository } from "@core/domains/auth/modules/webauthn/repositories/webauthn-credential-repository";
import type { User } from "@core/domains/user/entities/user/index";
import {
  decodeCredentialId,
  encodeCredentialId,
  isValidSlotType,
  MAX_RECOVERY_PHRASE_SLOTS,
  VAULT_SLOT_TYPE_PASSWORD,
  VAULT_SLOT_TYPE_RECOVERY_PHRASE,
  VAULT_SLOT_TYPE_WEBAUTHN_PRF,
  validateE2eeNameBlob,
  validateSlotLabel,
  validateSlotSalt,
  validateSlotWrapBlob,
} from "@core/domains/user/modules/vault/embedded/vault-wrap";
import { VaultSlot } from "@core/domains/user/modules/vault/entities/vault-slot";
import type { VaultSlotRepository } from "@core/domains/user/modules/vault/repositories/vault-slot-repository";
import type {
  VaultPublicState,
  VaultSlotInput,
  VaultSlotPublic,
  VaultSlotUpdateInput,
} from "@core/domains/user/modules/vault/types";
import type { UserRepository } from "@core/domains/user/repositories/user-repository";
import {
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
    credentialId: slot.credentialId ? encodeCredentialId(slot.credentialId) : null,
    label: slot.label,
  };
}

export class VaultService {
  constructor(
    private readonly users: UserRepository,
    private readonly vaultSlots: VaultSlotRepository,
    private readonly webauthnCredentials: WebAuthnCredentialRepository
  ) {}

  async get(userId: string): Promise<VaultPublicState> {
    const user = await this._get(userId);
    const slots = await this.vaultSlots.findByFilters({ userId: user.id });

    return {
      e2eeVaultInitialized: slots.length > 0,
      e2eeSlots: slots.map(toPublicSlot),
      e2eeName: user.e2eeName,
    };
  }

  async initialize(
    userId: string,
    authAcr: string,
    slots: VaultSlotInput[],
    e2eeName?: string | null
  ): Promise<VaultSlotPublic[]> {
    const user = await this._get(userId);

    if (slots.length === 0) {
      throw new ValidationError("core.auth.vault.initialize.invalid.no-slots");
    }

    const existingCount = await this.vaultSlots.aggregate({ userId: user.id });
    if (existingCount > 0) {
      throw new ConflictError("core.auth.vault.initialize.conflict.already-initialized");
    }

    let nameBlob: string | null = null;
    if (e2eeName !== undefined && e2eeName !== null && e2eeName.trim().length > 0) {
      validateE2eeNameBlob(e2eeName);
      nameBlob = e2eeName.trim();
    }

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
    if (nameBlob !== null) {
      await this.users.save(user.withE2eeName(nameBlob));
    }

    return createdSlots.map(toPublicSlot);
  }

  async create(userId: string, authAcr: string, input: VaultSlotInput): Promise<VaultSlotPublic> {
    const user = await this._get(userId);
    const existing = await this.vaultSlots.findByFilters({ userId: user.id });

    if (existing.length === 0) {
      throw new ConflictError("core.auth.vault.invalid.not-initialized");
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
      throw new ValidationError("core.auth.vault.slot.invalid.create-failed");
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

    validateSlotSalt(input.salt);
    validateSlotWrapBlob(input.wrapBlob);

    const [updated] = await this.vaultSlots.update(
      { id: slot.id },
      {
        salt: input.salt.trim(),
        wrapBlob: input.wrapBlob.trim(),
        updatedAt: new Date(),
      }
    );
    if (!updated) {
      throw new EntityNotFoundError("core.auth.vault.slot.not-found", {
        entityName: "VaultSlot",
        id: slot.id,
      });
    }

    return toPublicSlot(updated);
  }

  async delete(userId: string, authAcr: string, slotId: string, password?: string): Promise<void> {
    const user = await this._get(userId);
    const existing = await this.vaultSlots.findByFilters({ userId: user.id });

    if (existing.length <= 1) {
      throw new ConflictError("core.auth.vault.slot.delete.conflict.last-slot");
    }

    const slot = await this._getOwnedSlot(user.id, slotId);

    if (!(await this._authorizeDelete(user, authAcr, existing, password))) {
      throw new UnauthorizedError("core.auth.vault.slot.unauthorized.failed");
    }

    await this.vaultSlots.delete({ id: slot.id });
  }

  async update(userId: string, blob: string): Promise<void> {
    const user = await this._get(userId);
    validateE2eeNameBlob(blob);

    const count = await this.vaultSlots.aggregate({ userId: user.id });
    if (count === 0) {
      throw new ConflictError("core.auth.vault.invalid.not-initialized");
    }

    await this.users.save(user.withE2eeName(blob.trim()));
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
      throw new ConflictError("core.auth.vault.credential.delete.conflict.only-decryption-key");
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
    const trimmedSalt = salt.trim();
    const trimmedWrap = wrapBlob.trim();
    validateSlotSalt(trimmedSalt);
    validateSlotWrapBlob(trimmedWrap);

    const slots = await this.vaultSlots.findByFilters({ userId });
    const existing = slots.find((slot) => slot.slotType === VAULT_SLOT_TYPE_PASSWORD);
    const now = new Date();

    if (existing) {
      await this.vaultSlots.update(
        { id: existing.id },
        { salt: trimmedSalt, wrapBlob: trimmedWrap, updatedAt: now }
      );
      return;
    }

    await this.vaultSlots.create(
      new VaultSlot(
        crypto.randomUUID(),
        userId,
        VAULT_SLOT_TYPE_PASSWORD,
        trimmedSalt,
        trimmedWrap,
        "",
        null,
        now,
        now
      )
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
    if (!isValidSlotType(slotType)) {
      throw new ValidationError("core.auth.vault.slot.invalid.type");
    }

    const salt = input.salt.trim();
    const wrapBlob = input.wrapBlob.trim();
    validateSlotSalt(salt);
    validateSlotWrapBlob(wrapBlob);

    const label = (input.label ?? "").trim();
    validateSlotLabel(label);

    let credentialId: Buffer | null = null;

    switch (slotType) {
      case VAULT_SLOT_TYPE_PASSWORD:
        if (existing.some((slot) => slot.slotType === VAULT_SLOT_TYPE_PASSWORD)) {
          throw new ConflictError("core.auth.vault.slot.conflict.duplicate");
        }
        break;
      case VAULT_SLOT_TYPE_RECOVERY_PHRASE: {
        const count = existing.filter(
          (slot) => slot.slotType === VAULT_SLOT_TYPE_RECOVERY_PHRASE
        ).length;
        if (count >= MAX_RECOVERY_PHRASE_SLOTS) {
          throw new ConflictError("core.auth.vault.slot.conflict.duplicate");
        }
        break;
      }
      case VAULT_SLOT_TYPE_WEBAUTHN_PRF: {
        if (!input.credentialId || input.credentialId.trim().length === 0) {
          throw new ValidationError("core.auth.vault.slot.invalid.credential-id-required");
        }

        const raw = Buffer.from(decodeCredentialId(input.credentialId));
        const credential = await findFirst(
          this.webauthnCredentials.findByFilters.bind(this.webauthnCredentials),
          { credentialId: raw }
        );
        if (!credential || credential.userId !== userId) {
          throw new ValidationError("core.auth.vault.slot.invalid.credential-not-found");
        }

        if (
          existing.some(
            (slot) =>
              slot.slotType === VAULT_SLOT_TYPE_WEBAUTHN_PRF &&
              slot.credentialId !== null &&
              slot.credentialId.equals(raw)
          )
        ) {
          throw new ConflictError("core.auth.vault.slot.conflict.duplicate");
        }

        credentialId = raw;
        break;
      }
    }

    return new VaultSlot(
      crypto.randomUUID(),
      userId,
      slotType,
      salt,
      wrapBlob,
      label,
      credentialId,
      now,
      now
    );
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
      throw new UnauthorizedError("core.auth.vault.slot.unauthorized.failed");
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

    return verifyPassword(password, user.passwordHash);
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
      throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired");
    }

    return user;
  }

  private async _getOwnedSlot(userId: string, slotId: string): Promise<VaultSlot> {
    const slot = await this.vaultSlots.findById(slotId);
    if (!slot || slot.userId !== userId) {
      throw new EntityNotFoundError("core.auth.vault.slot.not-found", {
        entityName: "VaultSlot",
        id: slotId,
      });
    }

    return slot;
  }
}
