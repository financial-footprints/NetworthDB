import type { AppEnv } from "@core/domains/auth/constants";
import {
  hashPassword,
  seedHashPassword,
  validatePassword,
  verifyPassword,
} from "@core/domains/auth/embedded/password";
import type {
  LoginResult,
  PasswordLockout,
  ResolvedSession,
  SessionTokenPair,
} from "@core/domains/auth/helpers";
import { type AuthContext, assertAal2, passwordOnlyAuth } from "@core/domains/auth/helpers";
import type { MultifactorChallengeRepository } from "@core/domains/auth/modules/multifactor/repositories/multifactor-challenge-repository";
import type { RecoveryCodeRepository } from "@core/domains/auth/modules/multifactor/repositories/recovery-code-repository";
import {
  MultifactorService,
  type MultifactorServiceConfig,
} from "@core/domains/auth/modules/multifactor/services/multifactor-service";
import type { RecoveryChallengeRepository } from "@core/domains/auth/modules/recovery/repositories/recovery-challenge-repository";
import {
  RecoveryService,
  type RecoveryServiceConfig,
} from "@core/domains/auth/modules/recovery/services/recovery-service";
import type { WebAuthnCredentialRepository } from "@core/domains/auth/modules/webauthn/repositories/webauthn-credential-repository";
import type { WebAuthnSessionRepository } from "@core/domains/auth/modules/webauthn/repositories/webauthn-session-repository";
import {
  WebAuthnService,
  type WebAuthnServiceConfig,
} from "@core/domains/auth/modules/webauthn/services/webauthn-service";
import type { SessionRepository } from "@core/domains/auth/repositories/session-repository";
import { SessionLifecycle } from "@core/domains/auth/services/session-lifecycle";
import type { PublicUser } from "@core/domains/user/entities/public-user";
import { Username } from "@core/domains/user/entities/user/index";
import type { VaultService } from "@core/domains/user/modules/vault/services/vault-service";
import type { UserRepository } from "@core/domains/user/repositories/user-repository";
import type { EmailSender } from "@core/ports/email";
import type { RateLimiter } from "@core/ports/rate-limiter";
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
} from "@core/shared/errors/domain-error";
import { findFirst } from "@core/shared/query";

let dummyPasswordHashPromise: Promise<string> | null = null;

function dummyPasswordHash(): Promise<string> {
  dummyPasswordHashPromise ??= seedHashPassword("__ndb_dummy_login__");
  return dummyPasswordHashPromise;
}

export type AuthServiceConfig = {
  sessionTtl: number;
  refreshTtl: number;
  appEnv: AppEnv;
  multifactor: MultifactorServiceConfig;
  webauthn: WebAuthnServiceConfig;
  recovery: RecoveryServiceConfig;
};

export type AuthServiceDeps = {
  users: UserRepository;
  sessions: SessionRepository;
  multifactorChallenges: MultifactorChallengeRepository;
  recoveryCodes: RecoveryCodeRepository;
  recoveryChallenges: RecoveryChallengeRepository;
  webauthnCredentials: WebAuthnCredentialRepository;
  webauthnSessions: WebAuthnSessionRepository;
  vault: VaultService;
  emailSender: EmailSender;
  passwordLockout: PasswordLockout;
  rateLimiter: RateLimiter;
  config: AuthServiceConfig;
};

export class AuthService {
  readonly multifactor: MultifactorService;
  readonly webauthn: WebAuthnService;
  readonly recovery: RecoveryService;

  private readonly users: UserRepository;
  private readonly sessions: SessionLifecycle;
  private readonly passwordLockout: PasswordLockout;
  private readonly rateLimiter: RateLimiter;
  private readonly config: AuthServiceConfig;

  constructor(deps: AuthServiceDeps) {
    this.users = deps.users;
    this.passwordLockout = deps.passwordLockout;
    this.rateLimiter = deps.rateLimiter;
    this.config = deps.config;
    this.sessions = new SessionLifecycle(deps.sessions, {
      sessionTtl: deps.config.sessionTtl,
      refreshTtl: deps.config.refreshTtl,
    });
    this.multifactor = new MultifactorService(
      deps.users,
      this.sessions,
      deps.multifactorChallenges,
      deps.recoveryCodes,
      deps.webauthnCredentials,
      deps.config.multifactor
    );
    this.webauthn = new WebAuthnService(
      deps.users,
      this.sessions,
      deps.multifactorChallenges,
      deps.webauthnCredentials,
      deps.webauthnSessions,
      deps.recoveryCodes,
      deps.config.webauthn,
      (user, input) => this.multifactor.verifyProof(user, input),
      deps.vault
    );
    this.multifactor.setWebAuthnProofVerifier((user, sessionId, response) =>
      this.webauthn.verifyProof(user, sessionId, response)
    );
    this.recovery = new RecoveryService(
      deps.users,
      this.sessions,
      deps.recoveryChallenges,
      this.multifactor,
      this.webauthn,
      deps.vault,
      deps.emailSender,
      deps.config.recovery
    );
  }

  async allowRequest(key: string): Promise<boolean> {
    return this.rateLimiter.allow(key);
  }

  async issue(userId: string, auth: AuthContext): Promise<SessionTokenPair> {
    return this.sessions.issue(userId, auth);
  }

  async revoke(userId: string): Promise<void> {
    await this.sessions.revoke({ userId });
  }

  async login(username: string, password: string): Promise<LoginResult> {
    const parsedUsername = Username.parse(username);
    const usernameKey = parsedUsername.toString();

    if (await this.passwordLockout.isLocked(usernameKey)) {
      const dummyHash = await dummyPasswordHash();
      await verifyPassword(password, dummyHash);
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }

    const user = await findFirst(this.users.findByFilters.bind(this.users), {
      username: parsedUsername,
    });
    const passwordHash = user?.passwordHash ?? (await dummyPasswordHash());
    const valid = await verifyPassword(password, passwordHash);

    if (!user || !valid) {
      await this.passwordLockout.recordFailure(usernameKey);
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }

    await this.passwordLockout.reset(usernameKey);

    if (user.totp.isLocked()) {
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }

    if (this.multifactor.needsAfterLogin(user)) {
      return this.multifactor.createChallenge(user);
    }

    return this.sessions.issue(user.id, passwordOnlyAuth());
  }

  async refresh(refreshToken: string): Promise<SessionTokenPair> {
    const session = await this.sessions.findByRefreshToken(refreshToken);
    if (!session?.isRefreshValid()) {
      throw new UnauthorizedError("core.auth.refresh.unauthorized.invalid-token");
    }

    const user = await this.users.findById(session.userId);
    if (!user) {
      throw new UnauthorizedError("core.auth.refresh.unauthorized.invalid-token");
    }

    return this.sessions.rotate(session);
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.revoke({ sessionId });
  }

  async get(sessionToken: string): Promise<ResolvedSession> {
    const session = await this.sessions.findValidAccess(sessionToken);
    if (!session) {
      throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired");
    }

    const user = await this.users.findById(session.userId);
    if (!user) {
      throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired");
    }

    return {
      user: await this.multifactor.buildUser(user),
      sessionId: session.id,
      authAmr: session.authAmr,
      authAcr: session.authAcr,
    };
  }

  async updatePassword(
    actor: PublicUser,
    authAcr: string,
    authAmr: string,
    currentPassword: string,
    newPassword: string
  ): Promise<SessionTokenPair> {
    assertAal2(actor.multifactorEnabled, authAcr);
    const user = await this._get(actor.id);
    await this._verifyPassword(user, currentPassword);
    validatePassword(newPassword, this.config.appEnv);

    const saved = await this.users.save(user.withPasswordHash(await hashPassword(newPassword)));
    await this.sessions.revoke({ userId: saved.id });
    return this.sessions.issue(saved.id, { amr: authAmr, acr: authAcr });
  }

  async updateUsername(
    actor: PublicUser,
    authAcr: string,
    authAmr: string,
    username: string,
    currentPassword: string
  ): Promise<SessionTokenPair> {
    assertAal2(actor.multifactorEnabled, authAcr);
    const user = await this._get(actor.id);
    await this._verifyPassword(user, currentPassword);

    const nextUsername = Username.parse(username);
    if (nextUsername.toString() === user.username.toString()) {
      throw new ValidationError("core.auth.username.invalid.unchanged");
    }

    const taken = await findFirst(this.users.findByFilters.bind(this.users), {
      username: nextUsername,
    });
    if (taken) {
      throw new ConflictError("core.user.username.conflict.taken", {
        username: nextUsername.toString(),
      });
    }

    const saved = await this.users.save(user.withUsername(nextUsername));
    await this.sessions.revoke({ userId: saved.id });
    return this.sessions.issue(saved.id, { amr: authAmr, acr: authAcr });
  }

  private async _get(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired");
    }

    return user;
  }

  private async _verifyPassword(
    user: { passwordHash: string },
    currentPassword: string
  ): Promise<void> {
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }
  }
}
