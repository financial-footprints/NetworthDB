import type { AppEnv } from "@core/domains/auth/constants";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
} from "@core/domains/auth/embedded/recovery-codes";
import { MultifactorChallenge } from "@core/domains/auth/entities/multifactor-challenge";
import { RecoveryCode } from "@core/domains/auth/entities/recovery-code";
import type {
  MultifactorChallengeResponse,
  MultifactorMethod,
  MultifactorProofInput,
  PublicMultifactorState,
  SessionTokenPair,
} from "@core/domains/auth/helpers";
import { assertAal2, recoveryCodeAuth, totpAuth } from "@core/domains/auth/helpers";
import type { MultifactorChallengeRepository } from "@core/domains/auth/repositories/multifactor-challenge-repository";
import type { RecoveryCodeRepository } from "@core/domains/auth/repositories/recovery-code-repository";
import type { WebAuthnCredentialRepository } from "@core/domains/auth/repositories/webauthn-credential-repository";
import type { SessionLifecycle } from "@core/domains/auth/services/session-lifecycle";
import type { User } from "@core/domains/user/entities/user/index";
import type { Role } from "@core/domains/user/helpers";
import type { UserRepository } from "@core/domains/user/repositories/user-repository";
import type { PasswordHasher, SecretBox, TokenDigest, TotpEngine } from "@core/ports/auth";
import { UnauthorizedError, ValidationError } from "@core/shared/errors/domain-error";
import { findFirst } from "@core/shared/query";

export type MultifactorServiceConfig = {
  mfaTotpSkew: number;
  mfaMaxFailures: number;
  mfaRequiredRoles: Role[];
  ttl: {
    challenge: number;
    lockout: number;
  };
  appEnv: AppEnv;
};

export type MultifactorBearerKind = "session" | "challenge";

export type ResolvedMultifactorBearer =
  | { kind: "session"; user: User; sessionId: string; authAcr: string; authAmr: string }
  | { kind: "challenge"; user: User; challengeId: string };

export type WebAuthnProofVerifier = (
  user: User,
  sessionId: string,
  response: Record<string, unknown>
) => Promise<void>;

function isMultifactorRequiredForRole(role: Role, requiredRoles: Role[], appEnv: AppEnv): boolean {
  if (requiredRoles.length > 0) {
    return requiredRoles.includes(role);
  }

  return appEnv === "production";
}

function needsMultifactorChallenge(user: User, multifactorRequiredForRole: boolean): boolean {
  if (user.multifactorEnabled) {
    return true;
  }

  return multifactorRequiredForRole;
}

function countProofFields(input: MultifactorProofInput): number {
  let count = 0;
  if (input.password) count += 1;
  if (input.totp) count += 1;
  if (input.recoveryCode) count += 1;
  if (input.webauthnSessionId && input.webauthnResponse) count += 1;
  return count;
}

export class MultifactorService {
  private webauthnProofVerifier: WebAuthnProofVerifier | null = null;

  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionLifecycle,
    private readonly challenges: MultifactorChallengeRepository,
    private readonly recoveryCodes: RecoveryCodeRepository,
    private readonly webauthnCredentials: WebAuthnCredentialRepository,
    private readonly password: PasswordHasher,
    private readonly totp: TotpEngine,
    private readonly secrets: SecretBox,
    private readonly tokens: TokenDigest,
    private readonly config: MultifactorServiceConfig
  ) {}

  setWebAuthnProofVerifier(verifier: WebAuthnProofVerifier): void {
    this.webauthnProofVerifier = verifier;
  }

  async createChallenge(user: User): Promise<MultifactorChallengeResponse> {
    if (user.totp.isLocked()) {
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }

    const enrollment =
      isMultifactorRequiredForRole(user.role, this.config.mfaRequiredRoles, this.config.appEnv) &&
      !user.multifactorEnabled;

    const { token, expiresIn } = await this._issueChallenge(user.id);
    const methods = await this._buildLoginMethods(user, enrollment);

    return {
      status: enrollment ? "multifactor_enrollment_required" : "multifactor_required",
      multifactorToken: token,
      expiresIn,
      methods,
    };
  }

  needsAfterLogin(user: User): boolean {
    const roleRequired = isMultifactorRequiredForRole(
      user.role,
      this.config.mfaRequiredRoles,
      this.config.appEnv
    );
    return needsMultifactorChallenge(user, roleRequired);
  }

  requiresEnrollment(role: Role): boolean {
    return isMultifactorRequiredForRole(role, this.config.mfaRequiredRoles, this.config.appEnv);
  }

  async clear(user: User): Promise<User> {
    await this.webauthnCredentials.delete({ userId: user.id });
    await this.recoveryCodes.delete({ userId: user.id });
    return this.users.save(user.withTotp(user.totp.cleared()).withMultifactorEnabled(false));
  }

  async buildState(user: User): Promise<PublicMultifactorState> {
    const webauthnCount = await this.webauthnCredentials.aggregate({ userId: user.id });
    const unusedRecovery = await this.recoveryCodes.aggregate({ userId: user.id, unused: true });
    const methods: string[] = [];

    if (user.totp.hasTotp()) {
      methods.push("totp");
    }
    if (webauthnCount > 0) {
      methods.push("webauthn");
    }

    return {
      multifactorMethods: methods,
      recoveryCodesEnabled: unusedRecovery > 0,
    };
  }

  async resolve(token: string): Promise<ResolvedMultifactorBearer> {
    const session = await this.sessions.findValidSession(token);
    if (session) {
      const user = await this.users.findById(session.userId);
      if (!user) {
        throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired");
      }

      return {
        kind: "session",
        user,
        sessionId: session.id,
        authAcr: session.authAcr,
        authAmr: session.authAmr,
      };
    }

    const challenge = await findFirst(this.challenges.findByFilters.bind(this.challenges), {
      tokenHash: this.tokens.sha256Hex(token),
    });
    if (!challenge?.isValid()) {
      throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired");
    }

    const user = await this.users.findById(challenge.userId);
    if (!user) {
      throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired");
    }

    return {
      kind: "challenge",
      user,
      challengeId: challenge.id,
    };
  }

  async verifyTotp(multifactorToken: string, code: string): Promise<SessionTokenPair> {
    const bearer = await this.resolve(multifactorToken);
    if (bearer.kind !== "challenge") {
      throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired");
    }

    const user = bearer.user;
    if (user.totp.isLocked()) {
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }

    if (!user.totp.hasTotp()) {
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }

    const secret = this._decryptConfirmedSecret(user);
    const result = this.totp.validate(
      secret,
      code,
      this.config.mfaTotpSkew,
      user.totp.totpLastStep
    );
    if (!result.valid) {
      await this._recordLoginFailure(user);
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }

    const challenge = await this.challenges.findById(bearer.challengeId);
    if (!challenge) {
      throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired");
    }

    const updated = await this.users.save(
      user.withTotp(user.totp.withLastStep(result.step).withResetFailures())
    );
    await this.challenges.save(challenge.withUsed(new Date()));
    await this.sessions.revoke({ userId: updated.id });

    return this.sessions.issue(updated.id, totpAuth());
  }

  async verifyRecoveryCode(multifactorToken: string, code: string): Promise<SessionTokenPair> {
    const bearer = await this.resolve(multifactorToken);
    if (bearer.kind !== "challenge") {
      throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired");
    }

    const user = bearer.user;
    if (user.totp.isLocked()) {
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }

    const stored = await findFirst(this.recoveryCodes.findByFilters.bind(this.recoveryCodes), {
      userId: user.id,
      codeHash: hashRecoveryCode(this.tokens, code),
      unused: true,
    });
    if (!stored) {
      await this._recordLoginFailure(user);
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }

    const challenge = await this.challenges.findById(bearer.challengeId);
    if (!challenge) {
      throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired");
    }

    await this.recoveryCodes.save(stored.withUsed(new Date()));
    await this.users.save(user.withTotp(user.totp.withResetFailures()));
    await this.challenges.save(challenge.withUsed(new Date()));
    await this.sessions.revoke({ userId: user.id });

    return this.sessions.issue(user.id, recoveryCodeAuth());
  }

  async generateCodes(user: User, proof: MultifactorProofInput): Promise<string[]> {
    if (!user.multifactorEnabled) {
      throw new ValidationError("core.auth.multifactor.invalid.not-enabled");
    }

    const stored = await this._get(user.id);
    await this.verifyProof(stored, proof);

    const generated = generateRecoveryCodes(this.tokens);
    await this.recoveryCodes.delete({ userId: stored.id });
    const now = new Date();
    await this.recoveryCodes.create(
      generated.hashes.map((hash) => new RecoveryCode(crypto.randomUUID(), stored.id, hash, now))
    );
    await this.sessions.revoke({ userId: stored.id });

    return generated.plain;
  }

  async clearCodes(user: User, proof: MultifactorProofInput): Promise<void> {
    const stored = await this._get(user.id);
    await this.verifyProof(stored, proof);

    const unused = await this.recoveryCodes.aggregate({ userId: stored.id, unused: true });
    if (unused === 0) {
      throw new ValidationError("core.auth.multifactor.invalid.recovery-codes-not-enrolled");
    }

    await this.recoveryCodes.delete({ userId: stored.id });
    await this.sessions.revoke({ userId: stored.id });
  }

  async verifyProof(user: User, input: MultifactorProofInput): Promise<void> {
    if (countProofFields(input) !== 1) {
      throw new ValidationError("core.auth.multifactor.verify.invalid.proof-count");
    }

    if (input.totp) {
      const secret = this._decryptConfirmedSecret(user);
      const result = this.totp.validate(
        secret,
        input.totp,
        this.config.mfaTotpSkew,
        user.totp.totpLastStep
      );
      if (!result.valid) {
        throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
      }

      await this.users.save(user.withTotp(user.totp.withLastStep(result.step)));
      return;
    }

    if (input.recoveryCode) {
      const stored = await findFirst(this.recoveryCodes.findByFilters.bind(this.recoveryCodes), {
        userId: user.id,
        codeHash: hashRecoveryCode(this.tokens, input.recoveryCode),
        unused: true,
      });
      if (!stored) {
        throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
      }

      await this.recoveryCodes.save(stored.withUsed(new Date()));
      return;
    }

    if (input.webauthnSessionId && input.webauthnResponse) {
      if (!this.webauthnProofVerifier) {
        throw new ValidationError("core.auth.multifactor.webauthn.invalid.not-configured");
      }

      await this.webauthnProofVerifier(user, input.webauthnSessionId, input.webauthnResponse);
      return;
    }

    throw new ValidationError("core.auth.multifactor.verify.invalid.proof-required");
  }

  async recordFailure(user: User): Promise<void> {
    await this._recordLoginFailure(user);
  }

  async beginTotp(
    bearer: ResolvedMultifactorBearer,
    input: MultifactorProofInput
  ): Promise<{ uri: string }> {
    await this._requireStepUp(bearer, input);
    const user = await this._get(bearer.user.id);

    if (user.totp.hasPending()) {
      const secret = this._decryptPendingSecret(user);
      return { uri: this.totp.provisioningUri(user.username.toString(), secret) };
    }

    const generated = this.totp.generateSecret(user.username.toString());
    const pendingBlob = this.secrets.encrypt(generated.secret);
    await this.users.save(user.withTotp(user.totp.withPending(pendingBlob)));

    return { uri: generated.uri };
  }

  async confirmTotp(bearer: ResolvedMultifactorBearer, code: string): Promise<SessionTokenPair> {
    const user = await this._get(bearer.user.id);
    if (!user.totp.hasPending()) {
      throw new ValidationError("core.auth.multifactor.totp.invalid.not-started");
    }

    const pendingSecret = this._decryptPendingSecret(user);
    const result = this.totp.validate(pendingSecret, code, this.config.mfaTotpSkew, null);
    if (!result.valid && user.totp.hasTotp()) {
      const enrolledSecret = this._decryptConfirmedSecret(user);
      const enrolled = this.totp.validate(
        enrolledSecret,
        code,
        this.config.mfaTotpSkew,
        user.totp.totpLastStep
      );
      if (enrolled.valid) {
        throw new UnauthorizedError("core.auth.multifactor.totp.unauthorized.stale-code");
      }
    }

    if (!result.valid) {
      throw new UnauthorizedError("core.auth.multifactor.totp.unauthorized.invalid-code");
    }

    const confirmedBlob = this.secrets.encrypt(pendingSecret);
    const confirmedAt = new Date();
    const saved = await this.users.save(
      user
        .withMultifactorEnabled(true)
        .withTotp(user.totp.withConfirmed(confirmedBlob, confirmedAt, result.step))
    );

    if (bearer.kind === "challenge") {
      const challenge = await this.challenges.findById(bearer.challengeId);
      if (challenge) {
        await this.challenges.save(challenge.withUsed(new Date()));
      }
    }

    await this.sessions.revoke({ userId: saved.id });
    return this.sessions.issue(saved.id, totpAuth());
  }

  async disableTotp(user: User, authAcr: string, totpCode: string): Promise<void> {
    assertAal2(user.multifactorEnabled, authAcr);
    const stored = await this._get(user.id);
    if (!stored.totp.hasTotp()) {
      throw new ValidationError("core.auth.multifactor.totp.invalid.not-started");
    }

    const secret = this._decryptConfirmedSecret(stored);
    const result = this.totp.validate(
      secret,
      totpCode,
      this.config.mfaTotpSkew,
      stored.totp.totpLastStep
    );
    if (!result.valid) {
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }

    const webauthnCount = await this.webauthnCredentials.aggregate({ userId: stored.id });
    const roleRequired = isMultifactorRequiredForRole(
      stored.role,
      this.config.mfaRequiredRoles,
      this.config.appEnv
    );
    if (webauthnCount === 0 && roleRequired) {
      throw new ValidationError("core.auth.multifactor.disable.invalid.last-method");
    }

    const enabled = webauthnCount > 0;
    const saved = await this.users.save(
      stored
        .withMultifactorEnabled(enabled)
        .withTotp(stored.totp.cleared().withLastStep(result.step))
    );
    await this._clearRecoveryIfNoPrimary(saved, false, webauthnCount);
    await this.sessions.revoke({ userId: saved.id });
  }

  private async _clearRecoveryIfNoPrimary(
    user: User,
    hasTotp: boolean,
    webauthnCount: number
  ): Promise<void> {
    if (!hasTotp && webauthnCount === 0) {
      await this.recoveryCodes.delete({ userId: user.id });
    }
  }

  private async _buildLoginMethods(user: User, enrollment: boolean): Promise<MultifactorMethod[]> {
    if (enrollment) {
      return ["totp", "webauthn"];
    }

    const methods: MultifactorMethod[] = [];
    if (user.totp.hasTotp()) {
      methods.push("totp");
    }

    const webauthnCount = await this.webauthnCredentials.aggregate({ userId: user.id });
    if (webauthnCount > 0) {
      methods.push("webauthn");
    }

    const unusedRecovery = await this.recoveryCodes.aggregate({ userId: user.id, unused: true });
    if (unusedRecovery > 0) {
      methods.push("recovery");
    }

    if (user.multifactorEnabled && methods.length === 0) {
      methods.push("totp");
    }

    return methods;
  }

  private async _issueChallenge(userId: string): Promise<{ token: string; expiresIn: number }> {
    const token = this.tokens.randomHex(32);
    const now = new Date();
    const challenge = new MultifactorChallenge(
      crypto.randomUUID(),
      userId,
      this.tokens.sha256Hex(token),
      new Date(now.getTime() + this.config.ttl.challenge),
      now
    );
    await this.challenges.create(challenge);

    return {
      token,
      expiresIn: Math.floor(this.config.ttl.challenge / 1000),
    };
  }

  private _decryptConfirmedSecret(user: User): string {
    if (!user.totp.totpSecret) {
      throw new ValidationError("core.auth.multifactor.totp.invalid.not-started");
    }

    return this.secrets.decrypt(user.totp.totpSecret);
  }

  private _decryptPendingSecret(user: User): string {
    if (!user.totp.totpPending) {
      throw new ValidationError("core.auth.multifactor.totp.invalid.not-started");
    }

    return this.secrets.decrypt(user.totp.totpPending);
  }

  private async _requireStepUp(
    bearer: ResolvedMultifactorBearer,
    input: MultifactorProofInput
  ): Promise<void> {
    const user = bearer.user;

    if (bearer.kind === "challenge") {
      return;
    }

    if (!user.multifactorEnabled) {
      if (!input.password) {
        throw new ValidationError("core.auth.multifactor.invalid.password-required", {
          field: "password",
        });
      }

      const valid = await this.password.verify(input.password, user.passwordHash);
      if (!valid) {
        throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
      }

      return;
    }

    await this.verifyProof(user, input);
  }

  private async _recordLoginFailure(user: User): Promise<void> {
    const nextCount = user.totp.multifactorFailedCount + 1;
    const lockedUntil =
      nextCount >= this.config.mfaMaxFailures
        ? new Date(Date.now() + this.config.ttl.lockout)
        : null;
    await this.users.save(user.withTotp(user.totp.withFailure(nextCount, lockedUntil)));
  }

  private async _get(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired");
    }

    return user;
  }
}
