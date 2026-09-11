import type { AppEnv } from "@core/domains/auth/constants";
import { RECOVERY_KIND_ADVANCED, RECOVERY_KIND_PASSWORD_RESET } from "@core/domains/auth/constants";
import {
  hashRecoveryEmail,
  runDummyRecoveryEmailCheck,
  verifyRecoveryEmail,
} from "@core/domains/auth/embedded/recovery-email";
import {
  generateRecoveryToken,
  hashRecoverySecret,
} from "@core/domains/auth/embedded/recovery-token";
import { RecoveryChallenge } from "@core/domains/auth/entities/recovery-challenge";
import { RecoveryEmail } from "@core/domains/auth/entities/recovery-email";
import type {
  MultifactorChallengeResponse,
  MultifactorProofInput,
} from "@core/domains/auth/helpers";
import type { RecoveryChallengeRepository } from "@core/domains/auth/repositories/recovery-challenge-repository";
import type { MultifactorService } from "@core/domains/auth/services/multifactor-service";
import type { SessionLifecycle } from "@core/domains/auth/services/session-lifecycle";
import type {
  WebAuthnBeginResponse,
  WebAuthnService,
} from "@core/domains/auth/services/webauthn-service";
import type { User } from "@core/domains/user/entities/user/index";
import { Username } from "@core/domains/user/entities/user/index";
import { Password } from "@core/domains/user/entities/user/password";
import type { VaultSlot } from "@core/domains/user/modules/vault/entities/vault-slot";
import { VaultService } from "@core/domains/user/modules/vault/services/vault-service";
import type { VaultSlotPublic } from "@core/domains/user/modules/vault/types";
import type { UserRepository } from "@core/domains/user/repositories/user-repository";
import type { PasswordHasher, TokenDigest } from "@core/ports/auth";
import type { EmailSender } from "@core/ports/email";
import { UnauthorizedError, ValidationError } from "@core/shared/errors/domain-error";
import { findFirst } from "@core/shared/query";

export const RECOVERY_GENERIC_OK =
  "if an account exists and recovery email is configured, instructions have been sent";

export type RecoveryServiceConfig = {
  appEnv: AppEnv;
  recoveryAppBaseUrl: string | null;
  ttl: {
    password: number;
    advanced: number;
  };
};

type PasswordResetCompleteInput = {
  token: string;
  newPassword: string;
  multifactorProof: MultifactorProofInput;
};

export type AdvancedRecoveryContext = {
  vault: {
    initialize: boolean;
    recoveryMethods: string[];
    slots: VaultSlotPublic[];
  };
};

export type AdvancedRecoveryCompleteInput = {
  token: string;
  newPassword: string;
  passwordSlot?: { salt: string; wrapBlob: string };
  webauthnSessionId?: string;
  webauthnResponse?: Record<string, unknown>;
};

export class RecoveryService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionLifecycle,
    private readonly challenges: RecoveryChallengeRepository,
    private readonly multifactorService: MultifactorService,
    private readonly webauthnService: WebAuthnService,
    private readonly vaultService: VaultService,
    private readonly emailSender: EmailSender,
    private readonly password: PasswordHasher,
    private readonly tokens: TokenDigest,
    private readonly config: RecoveryServiceConfig
  ) {}

  async updateEmail(userId: string, password: string, email: string): Promise<void> {
    const user = await this._get(userId);
    const recoveryEmail = RecoveryEmail.parse(email);
    await this._requireCurrentPassword(user, password);

    const hash = await hashRecoveryEmail(this.password, recoveryEmail.toString());
    const now = new Date();
    await this.users.save(user.withRecoveryEmail(hash, now));
  }

  async deleteEmail(userId: string, password: string): Promise<void> {
    const user = await this._get(userId);
    await this._requireCurrentPassword(user, password);
    await this.users.save(user.clearRecoveryEmail());
  }

  async beginReset(username: string, email: string): Promise<{ message: string }> {
    return this._beginByEmail(username, email, {
      requireMultifactorEnabled: true,
      startChallenge: (user, email) => this._startResetChallenge(user, email),
    });
  }

  async beginAdvanced(username: string, email: string): Promise<{ message: string }> {
    return this._beginByEmail(username, email, {
      requireMultifactorEnabled: false,
      extraEligible: (user) => this.vaultService.hasRecoverySlot(user.id),
      startChallenge: (user, email) => this._startAdvancedChallenge(user, email),
    });
  }

  async getContext(tokenPlain: string): Promise<AdvancedRecoveryContext> {
    const { user } = await this._resolveAdvancedToken(tokenPlain);
    const state = await this.vaultService.get(user.id);

    return {
      vault: {
        initialize: state.vaultInitialized,
        recoveryMethods: VaultService.vaultRecoveryMethods(state.vaultSlots),
        slots: state.vaultSlots,
      },
    };
  }

  async beginResetWebAuthn(tokenPlain: string): Promise<WebAuthnBeginResponse> {
    const { user } = await this._resolveResetToken(tokenPlain);
    return this.webauthnService.beginReset(user);
  }

  async beginAdvancedWebAuthn(tokenPlain: string): Promise<WebAuthnBeginResponse> {
    const { user } = await this._resolveAdvancedToken(tokenPlain);
    const slots = await this.vaultService.list(user.id);
    return this.webauthnService.beginAdvanced(user, slots);
  }

  async completeReset(input: PasswordResetCompleteInput): Promise<void> {
    const token = input.token.trim();
    const newPassword = input.newPassword;

    if (token.length === 0 || newPassword.length === 0) {
      throw new ValidationError("core.auth.recovery.complete.invalid.missing-fields");
    }

    const parsedPassword = Password.parse(newPassword, this.config.appEnv);

    const { user, challenge } = await this._resolveResetToken(token);

    if (user.totp.isLocked()) {
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }

    try {
      await this.multifactorService.verifyProof(user, input.multifactorProof);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        await this.multifactorService.recordFailure(user);
      }

      throw error;
    }

    const refreshed = await this.users.findById(user.id);
    if (!refreshed) {
      throw new ValidationError("core.auth.recovery.invalid.expired-token");
    }

    const passwordHash = await this.password.hash(parsedPassword.toString());
    const updated = await this.users.save(
      refreshed.withPasswordHash(passwordHash).withTotp(refreshed.totp.withResetFailures())
    );
    await this.sessions.revoke({ userId: updated.id });
    await this.challenges.update({ id: challenge.id }, { usedAt: new Date() });
  }

  async completeAdvanced(
    input: AdvancedRecoveryCompleteInput
  ): Promise<MultifactorChallengeResponse | null> {
    const token = input.token.trim();
    const newPassword = input.newPassword;

    if (token.length === 0 || newPassword.length === 0) {
      throw new ValidationError("core.auth.recovery.complete.invalid.missing-fields");
    }

    const parsedPassword = Password.parse(newPassword, this.config.appEnv);

    const { user, challenge } = await this._resolveAdvancedToken(token);
    const slots = await this.vaultService.list(user.id);
    const vaultInitialized = slots.length > 0;
    const { salt: passwordSalt, wrapBlob: passwordWrap } = this._resolveAdvancedPasswordSlot(
      vaultInitialized,
      input
    );

    await this._verifyAdvancedWebauthn(user, slots, input);

    const cleared = await this.multifactorService.clear(user);
    const passwordHash = await this.password.hash(parsedPassword.toString());
    const updated = await this.users.save(
      cleared.withPasswordHash(passwordHash).withTotp(cleared.totp.withResetFailures())
    );

    if (vaultInitialized) {
      await this.vaultService.upsertPassword(updated.id, passwordSalt, passwordWrap);
    }

    await this.sessions.revoke({ userId: updated.id });
    await this.challenges.update({ id: challenge.id }, { usedAt: new Date() });

    if (this.multifactorService.requiresEnrollment(updated.role)) {
      const refreshed = await this.users.findById(updated.id);
      if (!refreshed) {
        throw new ValidationError("core.auth.recovery.invalid.expired-token");
      }

      return this.multifactorService.createChallenge(refreshed);
    }

    return null;
  }

  private _resolveAdvancedPasswordSlot(
    vaultInitialized: boolean,
    input: AdvancedRecoveryCompleteInput
  ): { salt: string; wrapBlob: string } {
    if (!vaultInitialized) {
      return { salt: "", wrapBlob: "" };
    }

    const salt = input.passwordSlot?.salt?.trim() ?? "";
    const wrapBlob = input.passwordSlot?.wrapBlob?.trim() ?? "";
    if (salt.length === 0 || wrapBlob.length === 0) {
      throw new ValidationError("core.auth.recovery.advanced.invalid.password-slot-required");
    }

    return { salt, wrapBlob };
  }

  private async _verifyAdvancedWebauthn(
    user: User,
    slots: VaultSlot[],
    input: AdvancedRecoveryCompleteInput
  ): Promise<void> {
    const webauthnSessionId = input.webauthnSessionId?.trim() ?? "";
    const webauthnResponse = input.webauthnResponse;
    if (webauthnSessionId.length === 0 || !webauthnResponse) {
      return;
    }

    const credentialId = await this.webauthnService.verifyReturningCredential(
      user,
      webauthnSessionId,
      webauthnResponse
    );
    if (!this.vaultService.matchesPrfCredential(slots, credentialId)) {
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }
  }

  private async _beginByEmail(
    username: string,
    email: string,
    options: {
      requireMultifactorEnabled: boolean;
      extraEligible?: (user: User) => Promise<boolean>;
      startChallenge: (user: User, email: string) => Promise<void>;
    }
  ): Promise<{ message: string }> {
    const parsedUsername = Username.parse(username);
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail.length === 0) {
      throw new ValidationError("core.auth.recovery.email.invalid.missing-fields");
    }

    const user = await findFirst(this.users.findByFilters.bind(this.users), {
      username: parsedUsername,
    });
    if (!user || !this._isEligible(user, options.requireMultifactorEnabled)) {
      await runDummyRecoveryEmailCheck(this.password, normalizedEmail);
      return { message: RECOVERY_GENERIC_OK };
    }

    await this._tryStartChallenge(user, normalizedEmail, options);
    return { message: RECOVERY_GENERIC_OK };
  }

  private _isEligible(user: User, requireMultifactorEnabled: boolean): boolean {
    if (!user.hasRecoveryEmail() || !user.recoveryEmailHash) {
      return false;
    }

    if (requireMultifactorEnabled && !user.multifactorEnabled) {
      return false;
    }

    return true;
  }

  private async _tryStartChallenge(
    user: User,
    email: string,
    options: {
      extraEligible?: (user: User) => Promise<boolean>;
      startChallenge: (user: User, email: string) => Promise<void>;
    }
  ): Promise<void> {
    if (!user.recoveryEmailHash) {
      await runDummyRecoveryEmailCheck(this.password, email);
      return;
    }

    const match = await verifyRecoveryEmail(this.password, email, user.recoveryEmailHash);
    if (!match) {
      await runDummyRecoveryEmailCheck(this.password, email);
      return;
    }

    let canStart = true;
    if (options.extraEligible) {
      canStart = await options.extraEligible(user);
    }

    if (!canStart) {
      await runDummyRecoveryEmailCheck(this.password, email);
      return;
    }

    try {
      await options.startChallenge(user, email);
    } catch {
      // Email or persistence failures are logged at the adapter layer; response stays generic.
    }
  }

  private async _resolveResetToken(
    tokenPlain: string
  ): Promise<{ user: User; challenge: RecoveryChallenge }> {
    return this._resolveToken(tokenPlain, RECOVERY_KIND_PASSWORD_RESET);
  }

  private async _resolveAdvancedToken(
    tokenPlain: string
  ): Promise<{ user: User; challenge: RecoveryChallenge }> {
    return this._resolveToken(tokenPlain, RECOVERY_KIND_ADVANCED);
  }

  private async _resolveToken(
    tokenPlain: string,
    kind: string
  ): Promise<{ user: User; challenge: RecoveryChallenge }> {
    const token = tokenPlain.trim();
    if (token.length === 0) {
      throw new ValidationError("core.auth.recovery.invalid.expired-token");
    }

    const challenge = await findFirst(this.challenges.findByFilters.bind(this.challenges), {
      kind,
      secretHash: hashRecoverySecret(this.tokens, token),
      active: true,
    });
    if (!challenge) {
      throw new ValidationError("core.auth.recovery.invalid.expired-token");
    }

    const user = await this.users.findById(challenge.userId);
    if (!user) {
      throw new ValidationError("core.auth.recovery.invalid.expired-token");
    }

    return { user, challenge };
  }

  private async _startResetChallenge(user: User, to: string): Promise<void> {
    const plain = generateRecoveryToken(this.tokens);
    const now = new Date();

    await this.challenges.update(
      { userId: user.id, kind: RECOVERY_KIND_PASSWORD_RESET, active: true },
      { usedAt: now }
    );
    await this.challenges.create(
      new RecoveryChallenge(
        crypto.randomUUID(),
        user.id,
        RECOVERY_KIND_PASSWORD_RESET,
        hashRecoverySecret(this.tokens, plain),
        new Date(now.getTime() + this.config.ttl.password),
        now
      )
    );

    const link = this._buildResetLink(plain);
    const body = [
      "A password reset was requested for your account.",
      "",
      "Use this link or token to reset your password (requires MFA):",
      link,
      "",
      "Token:",
      plain,
      "",
      "If you did not request this, ignore this email.",
    ].join("\n");

    try {
      await this.emailSender.sendEmail({
        to: [to],
        subject: "Password reset request",
        body,
      });
    } catch {
      // Delivery failures must not change the public begin response.
    }
  }

  private async _startAdvancedChallenge(user: User, to: string): Promise<void> {
    const plain = generateRecoveryToken(this.tokens);
    const now = new Date();

    await this.challenges.update(
      { userId: user.id, kind: RECOVERY_KIND_ADVANCED, active: true },
      { usedAt: now }
    );
    await this.challenges.create(
      new RecoveryChallenge(
        crypto.randomUUID(),
        user.id,
        RECOVERY_KIND_ADVANCED,
        hashRecoverySecret(this.tokens, plain),
        new Date(now.getTime() + this.config.ttl.advanced),
        now
      )
    );

    const link = this._buildAdvancedLink(plain);
    const body = [
      "Advanced account recovery was requested for your account.",
      "",
      "Use this link or token to complete recovery:",
      link,
      "",
      "Token:",
      plain,
      "",
      "If you did not request this, ignore this email.",
    ].join("\n");

    try {
      await this.emailSender.sendEmail({
        to: [to],
        subject: "Advanced recovery request",
        body,
      });
    } catch {
      // Delivery failures must not change the public begin response.
    }
  }

  private _buildResetLink(tokenPlain: string): string {
    if (!this.config.recoveryAppBaseUrl) {
      return tokenPlain;
    }

    return `${this.config.recoveryAppBaseUrl}/recovery/password#token=${tokenPlain}`;
  }

  private _buildAdvancedLink(tokenPlain: string): string {
    if (!this.config.recoveryAppBaseUrl) {
      return tokenPlain;
    }

    return `${this.config.recoveryAppBaseUrl}/recovery/advanced#token=${tokenPlain}`;
  }

  private async _requireCurrentPassword(user: User, password: string): Promise<void> {
    if (password.length === 0) {
      throw new ValidationError("core.auth.recovery.invalid.password-required", {
        field: "password",
      });
    }

    const valid = await this.password.verify(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }
  }

  private async _get(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired");
    }

    return user;
  }
}
