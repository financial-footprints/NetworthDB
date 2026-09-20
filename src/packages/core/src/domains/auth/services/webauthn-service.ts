import type { AppEnv } from "@core/domains/auth/constants";
import {
  decodeWebAuthnCeremonyBlob,
  encodeWebAuthnCeremonyBlob,
} from "@core/domains/auth/embedded/webauthn-ceremony";
import { WebAuthnCredential } from "@core/domains/auth/entities/webauthn-credential";
import { WebAuthnSession } from "@core/domains/auth/entities/webauthn-session";
import type { MultifactorProofInput, SessionTokenPair } from "@core/domains/auth/helpers";
import { webauthnAuth } from "@core/domains/auth/helpers";
import type { MultifactorChallengeRepository } from "@core/domains/auth/repositories/multifactor-challenge-repository";
import type { RecoveryCodeRepository } from "@core/domains/auth/repositories/recovery-code-repository";
import type { WebAuthnCredentialRepository } from "@core/domains/auth/repositories/webauthn-credential-repository";
import type { WebAuthnSessionRepository } from "@core/domains/auth/repositories/webauthn-session-repository";
import type { ResolvedMultifactorBearer } from "@core/domains/auth/services/multifactor-service";
import type { SessionLifecycle } from "@core/domains/auth/services/session-lifecycle";
import type { User } from "@core/domains/user/entities/user/index";
import type { Role } from "@core/domains/user/helpers";
import type { UserRepository } from "@core/domains/user/repositories/user-repository";
import type { VaultSlot } from "@core/domains/user/vault/entities/vault-slot";
import type { VaultService } from "@core/domains/user/vault/services/vault-service";
import type { PasswordHasher, TokenDigest, WebAuthnRelyingParty } from "@core/ports/auth";
import {
  EntityNotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@core/shared/errors/domain-error";
import { findFirst } from "@core/shared/query";

export type WebAuthnServiceConfig = {
  ttl: {
    session: number;
  };
  mfaRequiredRoles: Role[];
  appEnv: AppEnv;
};

export type WebAuthnBeginResponse = {
  sessionId: string;
  options: Record<string, unknown>;
};

export type WebAuthnCredentialSummary = {
  id: string;
  name: string;
  createdAt: Date;
};

export class WebAuthnService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionLifecycle,
    private readonly challenges: MultifactorChallengeRepository,
    private readonly credentials: WebAuthnCredentialRepository,
    private readonly webauthnSessions: WebAuthnSessionRepository,
    private readonly recoveryCodes: RecoveryCodeRepository,
    private readonly password: PasswordHasher,
    private readonly tokens: TokenDigest,
    private readonly webauthn: WebAuthnRelyingParty,
    private readonly config: WebAuthnServiceConfig,
    private readonly verifyMfaProof: (user: User, input: MultifactorProofInput) => Promise<void>,
    private readonly vaultService: VaultService
  ) {}

  async registerBegin(
    bearer: ResolvedMultifactorBearer,
    input: MultifactorProofInput
  ): Promise<WebAuthnBeginResponse> {
    this._requireRp();
    await this._requireStepUp(bearer, input);

    const user = bearer.user;
    const credentials = await this.credentials.findByFilters(
      { userId: user.id },
      { column: "createdAt", direction: "asc" }
    );
    const options = await this.webauthn.createRegistrationOptions(
      { username: user.username.toString() },
      credentials
    );
    const sessionId = await this._storeCeremony(user.id, "registration", true, options);

    return { sessionId, options };
  }

  async registerFinish(
    bearer: ResolvedMultifactorBearer,
    sessionId: string,
    response: Record<string, unknown>,
    name?: string
  ): Promise<SessionTokenPair> {
    this._requireRp();
    const user = bearer.user;
    const ceremony = await this._loadCeremony(sessionId, user.id, "registration");
    const verified = await this.webauthn.verifyRegistration(ceremony.options, response);
    if (!verified.verified) {
      throw new UnauthorizedError("WebAuthn verification failed.");
    }

    const credentialName = name?.trim() || "Passkey";
    const credential = new WebAuthnCredential(
      crypto.randomUUID(),
      user.id,
      verified.credentialId,
      verified.publicKey,
      verified.attestationType,
      verified.transports,
      verified.counter,
      verified.multiDevice,
      verified.backedUp,
      credentialName,
      Buffer.alloc(16),
      new Date()
    );
    await this.credentials.create(credential);
    await this.users.save(user.withMultifactorEnabled(true));
    await this.webauthnSessions.delete({ id: sessionId });

    if (bearer.kind === "challenge") {
      const challenge = await this.challenges.findById(bearer.challengeId);
      if (challenge) {
        await this.challenges.save(challenge.withUsed(new Date()));
      }
    }

    await this.sessions.revoke({ userId: user.id });
    return this.sessions.issue(user.id, webauthnAuth());
  }

  async beginReset(user: User): Promise<WebAuthnBeginResponse> {
    this._requireRp();
    const credentials = await this.credentials.findByFilters(
      { userId: user.id },
      { column: "createdAt", direction: "asc" }
    );
    if (credentials.length === 0) {
      throw new ValidationError("No passkeys are enrolled.");
    }

    const options = await this.webauthn.createAuthenticationOptions(
      { username: user.username.toString() },
      credentials
    );
    const sessionId = await this._storeCeremony(user.id, "authentication", true, options);
    return { sessionId, options };
  }

  async beginAdvanced(user: User, vaultSlots: VaultSlot[]): Promise<WebAuthnBeginResponse> {
    this._requireRp();
    const credentials = await this.credentials.findByFilters(
      { userId: user.id },
      { column: "createdAt", direction: "asc" }
    );
    const prfCredentials = this.vaultService.filterPrf(vaultSlots, credentials);

    if (prfCredentials.length === 0) {
      throw new ValidationError("No passkey supports vault recovery.");
    }

    const options = await this.webauthn.createAuthenticationOptions(
      { username: user.username.toString() },
      prfCredentials
    );
    const sessionId = await this._storeCeremony(user.id, "authentication", true, options);
    return { sessionId, options };
  }

  async loginBegin(
    bearer: ResolvedMultifactorBearer,
    input: MultifactorProofInput
  ): Promise<WebAuthnBeginResponse> {
    this._requireRp();
    const user = bearer.user;
    const credentials = await this.credentials.findByFilters(
      { userId: user.id },
      { column: "createdAt", direction: "asc" }
    );
    if (credentials.length === 0) {
      throw new ValidationError("No passkeys are enrolled.");
    }

    if (bearer.kind === "session" && user.multifactorEnabled) {
      await this.verifyMfaProof(user, input);
    }

    const options = await this.webauthn.createAuthenticationOptions(
      { username: user.username.toString() },
      credentials
    );
    const sessionId = await this._storeCeremony(user.id, "authentication", true, options);
    return { sessionId, options };
  }

  async loginFinish(
    multifactorToken: string,
    sessionId: string,
    response: Record<string, unknown>
  ): Promise<SessionTokenPair> {
    this._requireRp();
    const challenge = await findFirst(this.challenges.findByFilters.bind(this.challenges), {
      tokenHash: this.tokens.sha256Hex(multifactorToken),
    });
    if (!challenge?.isValid()) {
      throw new UnauthorizedError("Session is invalid or expired.");
    }

    const user = await this.users.findById(challenge.userId);
    if (!user || user.totp.isLocked()) {
      throw new UnauthorizedError("Invalid username or password.");
    }

    const ceremony = await this._loadCeremony(sessionId, user.id, "authentication");
    const stored = await this.credentials.findByFilters(
      { userId: user.id },
      { column: "createdAt", direction: "asc" }
    );
    const responseId = typeof response.id === "string" ? response.id : "";
    const credentialId = Buffer.from(responseId, "base64url");
    const credential = stored.find((item) => item.credentialId.equals(credentialId));
    if (!credential) {
      await this._recordLoginFailure(user);
      throw new UnauthorizedError("Invalid username or password.");
    }

    try {
      const verified = await this.webauthn.verifyAuthentication(
        ceremony.options,
        response,
        credential
      );
      if (!verified.verified) {
        throw new UnauthorizedError("Invalid username or password.");
      }

      await this.credentials.save(
        credential.withAuthenticatorState(verified.newCounter, verified.credentialBackedUp)
      );
    } catch {
      await this._recordLoginFailure(user);
      throw new UnauthorizedError("Invalid username or password.");
    }

    await this.webauthnSessions.delete({ id: sessionId });
    await this.users.save(user.withTotp(user.totp.withResetFailures()));
    await this.challenges.save(challenge.withUsed(new Date()));
    await this.sessions.revoke({ userId: user.id });
    return this.sessions.issue(user.id, webauthnAuth());
  }

  async verifyProof(
    user: User,
    sessionId: string,
    response: Record<string, unknown>
  ): Promise<void> {
    await this.verifyReturningCredential(user, sessionId, response);
  }

  async verifyReturningCredential(
    user: User,
    sessionId: string,
    response: Record<string, unknown>
  ): Promise<Buffer> {
    this._requireRp();
    const ceremony = await this._loadCeremony(sessionId, user.id, "authentication");
    const stored = await this.credentials.findByFilters(
      { userId: user.id },
      { column: "createdAt", direction: "asc" }
    );
    const responseId = typeof response.id === "string" ? response.id : "";
    const credentialId = Buffer.from(responseId, "base64url");
    const credential = stored.find((item) => item.credentialId.equals(credentialId));
    if (!credential) {
      throw new UnauthorizedError("Invalid username or password.");
    }

    const verified = await this.webauthn.verifyAuthentication(
      ceremony.options,
      response,
      credential
    );
    if (!verified.verified) {
      throw new UnauthorizedError("Invalid username or password.");
    }

    await this.credentials.save(
      credential.withAuthenticatorState(verified.newCounter, verified.credentialBackedUp)
    );
    await this.webauthnSessions.delete({ id: sessionId });
    return credential.credentialId;
  }

  async list(user: User): Promise<{ items: WebAuthnCredentialSummary[]; total: number }> {
    const credentials = await this.credentials.findByFilters(
      { userId: user.id },
      { column: "createdAt", direction: "asc" }
    );
    const items = credentials.map((credential) => ({
      id: credential.id,
      name: credential.name,
      createdAt: credential.createdAt,
    }));

    return { items, total: items.length };
  }

  async delete(user: User, credentialId: string, proof: MultifactorProofInput): Promise<void> {
    const stored = await this._get(user.id);
    await this.verifyMfaProof(stored, proof);

    const credential = await this.credentials.findById(credentialId);
    if (!credential || credential.userId !== stored.id) {
      throw new EntityNotFoundError("WebAuthnCredential", credentialId);
    }

    const count = await this.credentials.aggregate({ userId: stored.id });
    const hasTotp = stored.totp.hasTotp();
    const roleRequired = this._requiresMfaForRole(stored.role);
    if (count <= 1 && !hasTotp && roleRequired) {
      throw new ValidationError("Cannot disable the last authentication method.");
    }

    const hasVaultSlot = await this.vaultService.canDeleteCredential(
      stored.id,
      credential.credentialId
    );

    await this.credentials.delete({ id: credential.id });
    if (hasVaultSlot) {
      await this.vaultService.deleteCredential(stored.id, credential.credentialId);
    }
    const newCount = count - 1;
    const enabled = hasTotp || newCount > 0;
    await this.users.save(stored.withMultifactorEnabled(enabled));
    if (!hasTotp && newCount === 0) {
      await this.recoveryCodes.delete({ userId: stored.id });
    }
    await this.sessions.revoke({ userId: stored.id });
  }

  private async _storeCeremony(
    userId: string,
    kind: "registration" | "authentication",
    stepUpSatisfied: boolean,
    options: Record<string, unknown>
  ): Promise<string> {
    const now = new Date();
    const session = new WebAuthnSession(
      crypto.randomUUID(),
      userId,
      encodeWebAuthnCeremonyBlob({ kind, stepUpSatisfied, options }),
      new Date(now.getTime() + this.config.ttl.session),
      now
    );
    await this.webauthnSessions.create(session);
    return session.id;
  }

  private async _loadCeremony(
    sessionId: string,
    userId: string,
    expectedKind: "registration" | "authentication"
  ) {
    const session = await this.webauthnSessions.findById(sessionId);
    if (!session?.isValid() || session.userId !== userId) {
      throw new ValidationError("WebAuthn session is invalid.");
    }

    const ceremony = decodeWebAuthnCeremonyBlob(session.sessionData);
    if (ceremony.kind !== expectedKind) {
      throw new ValidationError("WebAuthn session is invalid.");
    }

    return ceremony;
  }

  private async _requireStepUp(
    bearer: ResolvedMultifactorBearer,
    input: MultifactorProofInput
  ): Promise<void> {
    if (bearer.kind === "challenge") {
      return;
    }

    if (!bearer.user.multifactorEnabled) {
      if (!input.password) {
        throw new ValidationError("Password is required.", {
          field: "password",
        });
      }

      const user = await this.users.findById(bearer.user.id);
      if (!user) {
        throw new UnauthorizedError("Session is invalid or expired.");
      }

      const valid = await this.password.verify(input.password, user.passwordHash);
      if (!valid) {
        throw new UnauthorizedError("Invalid username or password.");
      }

      return;
    }

    await this.verifyMfaProof(bearer.user, input);
  }

  private _requireRp(): void {
    if (!this.webauthn.isConfigured()) {
      throw new ValidationError("Passkeys are not configured.");
    }
  }

  private async _get(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedError("Session is invalid or expired.");
    }

    return user;
  }

  private _requiresMfaForRole(role: Role): boolean {
    if (this.config.mfaRequiredRoles.length > 0) {
      return this.config.mfaRequiredRoles.includes(role);
    }

    return this.config.appEnv === "production";
  }

  private async _recordLoginFailure(user: User): Promise<void> {
    const nextCount = user.totp.multifactorFailedCount + 1;
    const lockedUntil = nextCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await this.users.save(user.withTotp(user.totp.withFailure(nextCount, lockedUntil)));
  }
}
