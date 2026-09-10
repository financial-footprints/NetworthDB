import { hashPassword } from "@core/domains/auth/embedded/password";
import type { PasswordLockout } from "@core/domains/auth/helpers";
import { isSessionTokenPair } from "@core/domains/auth/helpers";
import { currentTotpStep } from "@core/domains/auth/modules/multifactor/embedded/totp";
import type { AuthService } from "@core/domains/auth/services/auth-service";
import { User, Username } from "@core/domains/user/entities/user/index";
import type { Role } from "@core/domains/user/helpers";
import type { VaultService } from "@core/domains/user/modules/vault/services/vault-service";
import type { InMemoryMultifactorChallengeRepository } from "@tests/core/fakes/in-memory-multifactor-challenge-repository";
import type { InMemoryRecoveryChallengeRepository } from "@tests/core/fakes/in-memory-recovery-challenge-repository";
import type { InMemoryRecoveryCodeRepository } from "@tests/core/fakes/in-memory-recovery-code-repository";
import type { InMemorySessionRepository } from "@tests/core/fakes/in-memory-session-repository";
import type { InMemoryUserRepository } from "@tests/core/fakes/in-memory-user-repository";
import type { InMemoryVaultSlotRepository } from "@tests/core/fakes/in-memory-vault-slot-repository";
import type { InMemoryWebAuthnCredentialRepository } from "@tests/core/fakes/in-memory-webauthn-credential-repository";
import type { InMemoryWebAuthnSessionRepository } from "@tests/core/fakes/in-memory-webauthn-session-repository";
import { CapturingEmailSender } from "@tests/core/helpers/auth/email";
import { createTestSecurityStores } from "@tests/core/helpers/auth/security";
import { createInMemoryAuthRepos, wireInMemoryAuth } from "@tests/core/helpers/auth/wiring";
import { getByUsername } from "@tests/core/helpers/helpers";
import { Secret, TOTP } from "otpauth";

export type TestAuthServices = {
  users: InMemoryUserRepository;
  sessions: InMemorySessionRepository;
  challenges: InMemoryMultifactorChallengeRepository;
  recoveryChallenges: InMemoryRecoveryChallengeRepository;
  recoveryCodes: InMemoryRecoveryCodeRepository;
  webauthnCredentials: InMemoryWebAuthnCredentialRepository;
  webauthnSessions: InMemoryWebAuthnSessionRepository;
  vaultSlots: InMemoryVaultSlotRepository;
  emailSender: CapturingEmailSender;
  auth: AuthService;
  vault: VaultService;
  passwordLockout: PasswordLockout;
};

export function totpCode(secretBase32: string): string {
  const totp = new TOTP({
    secret: Secret.fromBase32(secretBase32),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });

  return totp.generate();
}

export function secretFromUri(uri: string): string {
  const secretMatch = /secret=([A-Z2-7]+)/.exec(uri);
  if (!secretMatch?.[1]) {
    throw new Error("missing secret in uri");
  }

  return secretMatch[1];
}

export async function enrollTotp(
  services: { users: InMemoryUserRepository; auth: AuthService },
  username: string,
  password: string
): Promise<string> {
  const user = await getByUsername(services.users, username);
  const begin = await services.auth.multifactor.beginTotp(
    { kind: "session", user, sessionId: user.id, authAcr: "aal1", authAmr: "pwd" },
    { password }
  );
  const secret = secretFromUri(begin.uri);
  await services.auth.multifactor.confirmTotp(
    { kind: "session", user, sessionId: user.id, authAcr: "aal1", authAmr: "pwd" },
    totpCode(secret)
  );

  return secret;
}

export async function createTestAuthServices(
  username = "alice",
  password = "password123",
  role: Role = "user",
  multifactorEnabled = false,
  securityStores = createTestSecurityStores()
): Promise<TestAuthServices> {
  const repos = createInMemoryAuthRepos();
  const emailSender = new CapturingEmailSender();
  const passwordHash = await hashPassword(password);

  await repos.users.create(
    new User(
      crypto.randomUUID(),
      Username.parse(username),
      passwordHash,
      role,
      multifactorEnabled,
      new Date()
    )
  );

  const wired = wireInMemoryAuth(repos, emailSender, securityStores);

  return {
    ...repos,
    emailSender,
    ...wired,
  };
}

export async function loginAsSession(
  services: { auth: AuthService },
  username: string,
  password: string
): Promise<string> {
  const result = await services.auth.login(username, password);
  if (!isSessionTokenPair(result)) {
    throw new Error("login returned multifactor challenge");
  }

  return result.sessionToken;
}

export async function resetTotpStep(
  services: { users: InMemoryUserRepository },
  username: string
): Promise<User> {
  const user = await getByUsername(services.users, username);
  const saved = user.withTotp(user.totp.withLastStep(currentTotpStep() - 2));
  await services.users.save(saved);
  return saved;
}
