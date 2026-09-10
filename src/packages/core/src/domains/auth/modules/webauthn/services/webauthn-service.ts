import type { AppEnv } from "@core/domains/auth/constants";
import { hashSessionToken } from "@core/domains/auth/embedded/crypto";
import { verifyPassword } from "@core/domains/auth/embedded/password";
import type { MultifactorProofInput, SessionTokenPair } from "@core/domains/auth/helpers";
import { webauthnAuth } from "@core/domains/auth/helpers";
import type { MultifactorChallengeRepository } from "@core/domains/auth/modules/multifactor/repositories/multifactor-challenge-repository";
import type { RecoveryCodeRepository } from "@core/domains/auth/modules/multifactor/repositories/recovery-code-repository";
import type { ResolvedMultifactorBearer } from "@core/domains/auth/modules/multifactor/services/multifactor-service";
import {
  createAuthenticationOptions,
  createRegistrationOptions,
  decodeCeremonyBlob,
  encodeCeremonyBlob,
  verifyAuthentication,
  verifyRegistration,
  type WebAuthnRpConfig,
} from "@core/domains/auth/modules/webauthn/embedded/webauthn";
import { WebAuthnCredential } from "@core/domains/auth/modules/webauthn/entities/webauthn-credential";
import { WebAuthnSession } from "@core/domains/auth/modules/webauthn/entities/webauthn-session";
import type { WebAuthnCredentialRepository } from "@core/domains/auth/modules/webauthn/repositories/webauthn-credential-repository";
import type { WebAuthnSessionRepository } from "@core/domains/auth/modules/webauthn/repositories/webauthn-session-repository";
import type { SessionLifecycle } from "@core/domains/auth/services/session-lifecycle";
import type { PublicUser } from "@core/domains/user/entities/public-user";
import type { User } from "@core/domains/user/entities/user/index";
import type { Role } from "@core/domains/user/helpers";
import type { VaultSlot } from "@core/domains/user/modules/vault/entities/vault-slot";
import type { VaultService } from "@core/domains/user/modules/vault/services/vault-service";
import type { UserRepository } from "@core/domains/user/repositories/user-repository";
import {
  EntityNotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@core/shared/errors/domain-error";
import { findFirst } from "@core/shared/query";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";

export type WebAuthnServiceConfig = {
  rp: WebAuthnRpConfig | null;
  webauthnsessionTtl: number;
  mfaRequiredRoles: Role[];
  appEnv: AppEnv;
};

export type WebAuthnBeginResponse = {
  sessionId: string;
  options: PublicKeyCredentialCreationOptionsJSON | PublicKeyCredentialRequestOptionsJSON;
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
    private readonly config: WebAuthnServiceConfig,
    private readonly verifyMfaProof: (user: User, input: MultifactorProofInput) => Promise<void>,
    private readonly vaultService: VaultService
  ) {}

  async registerBegin(
    bearer: ResolvedMultifactorBearer,
    input: MultifactorProofInput
  ): Promise<WebAuthnBeginResponse> {
    const rp = this._requireRp();
    await this._requireStepUp(bearer, input);

    const user = bearer.user;
    const credentials = await this.credentials.findByFilters(
      { userId: user.id },
      { column: "createdAt", direction: "asc" }
    );
    const options = await createRegistrationOptions(rp, user, credentials);
    const sessionId = await this._storeCeremony(user.id, "registration", true, options);

    return { sessionId, options };
  }

  async registerFinish(
    bearer: ResolvedMultifactorBearer,
    sessionId: string,
    response: RegistrationResponseJSON,
    name?: string
  ): Promise<SessionTokenPair> {
    const rp = this._requireRp();
    const user = bearer.user;
    const ceremony = await this._loadCeremony(sessionId, user.id, "registration");
    const verified = await verifyRegistration(rp, ceremony.options as never, response);
    if (!verified.verified || !verified.registrationInfo) {
      throw new UnauthorizedError("core.auth.webauthn.verify.unauthorized.failed");
    }

    const credentialName = name?.trim() || "Passkey";
    const info = verified.registrationInfo;
    const credential = new WebAuthnCredential(
      crypto.randomUUID(),
      user.id,
      Buffer.from(info.credential.id),
      Buffer.from(info.credential.publicKey),
      info.attestationObject ? "packed" : "none",
      info.credential.transports?.join(",") ?? "",
      info.credential.counter,
      info.credentialDeviceType === "multiDevice",
      info.credentialBackedUp,
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
    const rp = this._requireRp();
    const credentials = await this.credentials.findByFilters(
      { userId: user.id },
      { column: "createdAt", direction: "asc" }
    );
    if (credentials.length === 0) {
      throw new ValidationError("core.auth.webauthn.invalid.not-enrolled");
    }

    const options = await createAuthenticationOptions(rp, user, credentials);
    const sessionId = await this._storeCeremony(user.id, "authentication", true, options);
    return { sessionId, options };
  }

  async beginAdvanced(user: User, vaultSlots: VaultSlot[]): Promise<WebAuthnBeginResponse> {
    const rp = this._requireRp();
    const credentials = await this.credentials.findByFilters(
      { userId: user.id },
      { column: "createdAt", direction: "asc" }
    );
    const prfCredentials = this.vaultService.filterPrf(vaultSlots, credentials);

    if (prfCredentials.length === 0) {
      throw new ValidationError("core.auth.webauthn.vault.invalid.no-passkey");
    }

    const options = await createAuthenticationOptions(rp, user, prfCredentials);
    const sessionId = await this._storeCeremony(user.id, "authentication", true, options);
    return { sessionId, options };
  }

  async loginBegin(
    bearer: ResolvedMultifactorBearer,
    input: MultifactorProofInput
  ): Promise<WebAuthnBeginResponse> {
    const rp = this._requireRp();
    const user = bearer.user;
    const credentials = await this.credentials.findByFilters(
      { userId: user.id },
      { column: "createdAt", direction: "asc" }
    );
    if (credentials.length === 0) {
      throw new ValidationError("core.auth.webauthn.invalid.not-enrolled");
    }

    if (bearer.kind === "session" && user.multifactorEnabled) {
      await this.verifyMfaProof(user, input);
    }

    const options = await createAuthenticationOptions(rp, user, credentials);
    const sessionId = await this._storeCeremony(user.id, "authentication", true, options);
    return { sessionId, options };
  }

  async loginFinish(
    multifactorToken: string,
    sessionId: string,
    response: AuthenticationResponseJSON
  ): Promise<SessionTokenPair> {
    const rp = this._requireRp();
    const challenge = await findFirst(this.challenges.findByFilters.bind(this.challenges), {
      tokenHash: hashSessionToken(multifactorToken),
    });
    if (!challenge?.isValid()) {
      throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired");
    }

    const user = await this.users.findById(challenge.userId);
    if (!user || user.totp.isLocked()) {
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }

    const ceremony = await this._loadCeremony(sessionId, user.id, "authentication");
    const stored = await this.credentials.findByFilters(
      { userId: user.id },
      { column: "createdAt", direction: "asc" }
    );
    const credentialId = Buffer.from(response.id, "base64url");
    const credential = stored.find((item) => item.credentialId.equals(credentialId));
    if (!credential) {
      await this._recordLoginFailure(user);
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }

    try {
      const verified = await verifyAuthentication(
        rp,
        ceremony.options as never,
        response,
        credential
      );
      if (!verified.verified) {
        throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
      }

      await this.credentials.save(
        credential.withAuthenticatorState(
          verified.authenticationInfo.newCounter,
          verified.authenticationInfo.credentialBackedUp
        )
      );
    } catch {
      await this._recordLoginFailure(user);
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
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
    response: AuthenticationResponseJSON
  ): Promise<void> {
    await this.verifyReturningCredential(user, sessionId, response);
  }

  async verifyReturningCredential(
    user: User,
    sessionId: string,
    response: AuthenticationResponseJSON
  ): Promise<Buffer> {
    const rp = this._requireRp();
    const ceremony = await this._loadCeremony(sessionId, user.id, "authentication");
    const stored = await this.credentials.findByFilters(
      { userId: user.id },
      { column: "createdAt", direction: "asc" }
    );
    const credentialId = Buffer.from(response.id, "base64url");
    const credential = stored.find((item) => item.credentialId.equals(credentialId));
    if (!credential) {
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }

    const verified = await verifyAuthentication(
      rp,
      ceremony.options as never,
      response,
      credential
    );
    if (!verified.verified) {
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }

    await this.credentials.save(
      credential.withAuthenticatorState(
        verified.authenticationInfo.newCounter,
        verified.authenticationInfo.credentialBackedUp
      )
    );
    await this.webauthnSessions.delete({ id: sessionId });
    return credential.credentialId;
  }

  async list(actor: PublicUser): Promise<{ items: WebAuthnCredentialSummary[]; total: number }> {
    const credentials = await this.credentials.findByFilters(
      { userId: actor.id },
      { column: "createdAt", direction: "asc" }
    );
    const items = credentials.map((credential) => ({
      id: credential.id,
      name: credential.name,
      createdAt: credential.createdAt,
    }));

    return { items, total: items.length };
  }

  async delete(
    actor: PublicUser,
    credentialId: string,
    proof: MultifactorProofInput
  ): Promise<void> {
    const user = await this._get(actor.id);
    await this.verifyMfaProof(user, proof);

    const credential = await this.credentials.findById(credentialId);
    if (!credential || credential.userId !== user.id) {
      throw new EntityNotFoundError("core.auth.webauthn.credential.not-found", {
        entityName: "WebAuthnCredential",
        id: credentialId,
      });
    }

    const count = await this.credentials.aggregate({ userId: user.id });
    const hasTotp = user.totp.hasTotp();
    const roleRequired = this._requiresMfaForRole(user.role);
    if (count <= 1 && !hasTotp && roleRequired) {
      throw new ValidationError("core.auth.multifactor.disable.invalid.last-method");
    }

    const hasVaultSlot = await this.vaultService.canDeleteCredential(
      user.id,
      credential.credentialId
    );

    await this.credentials.delete({ id: credential.id });
    if (hasVaultSlot) {
      await this.vaultService.deleteCredential(user.id, credential.credentialId);
    }
    const newCount = count - 1;
    const enabled = hasTotp || newCount > 0;
    await this.users.save(user.withMultifactorEnabled(enabled));
    if (!hasTotp && newCount === 0) {
      await this.recoveryCodes.delete({ userId: user.id });
    }
    await this.sessions.revoke({ userId: user.id });
  }

  private async _storeCeremony(
    userId: string,
    kind: "registration" | "authentication",
    stepUpSatisfied: boolean,
    options: PublicKeyCredentialCreationOptionsJSON | PublicKeyCredentialRequestOptionsJSON
  ): Promise<string> {
    const now = new Date();
    const session = new WebAuthnSession(
      crypto.randomUUID(),
      userId,
      encodeCeremonyBlob({ kind, stepUpSatisfied, options }),
      new Date(now.getTime() + this.config.webauthnsessionTtl),
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
      throw new ValidationError("core.auth.webauthn.session.invalid");
    }

    const ceremony = decodeCeremonyBlob(session.sessionData);
    if (ceremony.kind !== expectedKind) {
      throw new ValidationError("core.auth.webauthn.session.invalid");
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
        throw new ValidationError("core.auth.webauthn.invalid.password-required", {
          field: "password",
        });
      }

      const user = await this.users.findById(bearer.user.id);
      if (!user) {
        throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired");
      }

      const valid = await verifyPassword(input.password, user.passwordHash);
      if (!valid) {
        throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
      }

      return;
    }

    await this.verifyMfaProof(bearer.user, input);
  }

  private _requireRp(): WebAuthnRpConfig {
    if (!this.config.rp) {
      throw new ValidationError("core.auth.webauthn.invalid.not-configured");
    }

    return this.config.rp;
  }

  private async _get(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired");
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
