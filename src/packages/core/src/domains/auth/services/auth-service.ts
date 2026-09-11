import type { AppEnv } from "@core/domains/auth/constants";
import type {
  LoginResult,
  PasswordLockout,
  ResolvedSession,
  SessionTokenPair,
} from "@core/domains/auth/helpers";
import { type AuthContext, assertAal2, passwordOnlyAuth } from "@core/domains/auth/helpers";
import type { MultifactorChallengeRepository } from "@core/domains/auth/repositories/multifactor-challenge-repository";
import type { RecoveryChallengeRepository } from "@core/domains/auth/repositories/recovery-challenge-repository";
import type { RecoveryCodeRepository } from "@core/domains/auth/repositories/recovery-code-repository";
import type { SessionRepository } from "@core/domains/auth/repositories/session-repository";
import type { WebAuthnCredentialRepository } from "@core/domains/auth/repositories/webauthn-credential-repository";
import type { WebAuthnSessionRepository } from "@core/domains/auth/repositories/webauthn-session-repository";
import type { MultifactorServiceConfig } from "@core/domains/auth/services/multifactor-service";
import { MultifactorService } from "@core/domains/auth/services/multifactor-service";
import type { RecoveryServiceConfig } from "@core/domains/auth/services/recovery-service";
import { RecoveryService } from "@core/domains/auth/services/recovery-service";
import { SessionLifecycle } from "@core/domains/auth/services/session-lifecycle";
import type { WebAuthnServiceConfig } from "@core/domains/auth/services/webauthn-service";
import { WebAuthnService } from "@core/domains/auth/services/webauthn-service";
import { User, Username } from "@core/domains/user/entities/user/index";
import { Password } from "@core/domains/user/entities/user/password";
import { assertAdministrator, type Role } from "@core/domains/user/helpers";
import type { VaultService } from "@core/domains/user/modules/vault/services/vault-service";
import type { UserRepository } from "@core/domains/user/repositories/user-repository";
import type { AuthCrypto } from "@core/ports/auth";
import type { EmailSender } from "@core/ports/email";
import type { RateLimiter } from "@core/ports/ratelimiter";
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
} from "@core/shared/errors/domain-error";
import { findFirst } from "@core/shared/query";

let dummyPasswordHashPromise: Promise<string> | null = null;

function dummyPasswordHash(crypto: AuthCrypto): Promise<string> {
  dummyPasswordHashPromise ??= crypto.password.hash("__ndb_dummy_login__");
  return dummyPasswordHashPromise;
}

export type RegisterUserInput = {
  username: string;
  password: string;
  role?: Role;
};

export type AuthServiceConfig = {
  ttl: {
    session: number;
    refresh: number;
  };
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
  crypto: AuthCrypto;
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
  private readonly crypto: AuthCrypto;
  private readonly config: AuthServiceConfig;

  constructor(deps: AuthServiceDeps) {
    this.users = deps.users;
    this.passwordLockout = deps.passwordLockout;
    this.rateLimiter = deps.rateLimiter;
    this.crypto = deps.crypto;
    this.config = deps.config;
    this.sessions = new SessionLifecycle(deps.sessions, deps.crypto.tokens, deps.config.ttl);
    this.multifactor = new MultifactorService(
      deps.users,
      this.sessions,
      deps.multifactorChallenges,
      deps.recoveryCodes,
      deps.webauthnCredentials,
      deps.crypto.password,
      deps.crypto.totp,
      deps.crypto.secrets,
      deps.crypto.tokens,
      deps.config.multifactor
    );
    this.webauthn = new WebAuthnService(
      deps.users,
      this.sessions,
      deps.multifactorChallenges,
      deps.webauthnCredentials,
      deps.webauthnSessions,
      deps.recoveryCodes,
      deps.crypto.password,
      deps.crypto.tokens,
      deps.crypto.webauthn,
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
      deps.crypto.password,
      deps.crypto.tokens,
      deps.config.recovery
    );
  }

  async allowRequest(key: string): Promise<boolean> {
    return this.rateLimiter.allow(key);
  }

  async register(user: User, authAcr: string, input: RegisterUserInput): Promise<User> {
    assertAdministrator(user);
    assertAal2(user.multifactorEnabled, authAcr);

    const username = Username.parse(input.username);
    const password = Password.parse(input.password, this.config.appEnv);
    const role: Role = input.role ?? "user";

    const existing = await findFirst(this.users.findByFilters.bind(this.users), { username });
    if (existing) {
      throw new ConflictError("core.user.username.conflict.taken", {
        username: username.toString(),
      });
    }

    const createdUser = new User(
      crypto.randomUUID(),
      username,
      await this.crypto.password.hash(password.toString()),
      role,
      false,
      new Date()
    );
    return this.users.create(createdUser);
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
      const dummyHash = await dummyPasswordHash(this.crypto);
      await this.crypto.password.verify(password, dummyHash);
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }

    const user = await findFirst(this.users.findByFilters.bind(this.users), {
      username: parsedUsername,
    });
    const passwordHash = user?.passwordHash ?? (await dummyPasswordHash(this.crypto));
    const valid = await this.crypto.password.verify(password, passwordHash);

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
    const session = await this.sessions.findValidSession(sessionToken);
    if (!session) {
      throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired");
    }

    const user = await this.users.findById(session.userId);
    if (!user) {
      throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired");
    }

    return {
      user,
      sessionId: session.id,
      authAmr: session.authAmr,
      authAcr: session.authAcr,
    };
  }

  async updatePassword(
    user: User,
    authAcr: string,
    authAmr: string,
    currentPassword: string,
    newPassword: string
  ): Promise<SessionTokenPair> {
    assertAal2(user.multifactorEnabled, authAcr);
    const stored = await this._get(user.id);
    await this._verifyPassword(stored, currentPassword);
    const parsedPassword = Password.parse(newPassword, this.config.appEnv);

    const saved = await this.users.save(
      stored.withPasswordHash(await this.crypto.password.hash(parsedPassword.toString()))
    );
    await this.sessions.revoke({ userId: saved.id });
    return this.sessions.issue(saved.id, { amr: authAmr, acr: authAcr });
  }

  async updateUsername(
    user: User,
    authAcr: string,
    authAmr: string,
    username: string,
    currentPassword: string
  ): Promise<SessionTokenPair> {
    assertAal2(user.multifactorEnabled, authAcr);
    const stored = await this._get(user.id);
    await this._verifyPassword(stored, currentPassword);

    const nextUsername = Username.parse(username);
    if (nextUsername.toString() === stored.username.toString()) {
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

    const saved = await this.users.save(stored.withUsername(nextUsername));
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
    const valid = await this.crypto.password.verify(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError("core.auth.unauthorized.invalid-credentials");
    }
  }
}
