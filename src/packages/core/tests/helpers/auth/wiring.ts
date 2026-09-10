import type { PasswordLockout } from "@core/domains/auth/helpers";
import { AuthService } from "@core/domains/auth/services/auth-service";
import { VaultService } from "@core/domains/user/modules/vault/services/vault-service";
import { InMemoryMultifactorChallengeRepository } from "@tests/core/fakes/in-memory-multifactor-challenge-repository";
import { InMemoryRecoveryChallengeRepository } from "@tests/core/fakes/in-memory-recovery-challenge-repository";
import { InMemoryRecoveryCodeRepository } from "@tests/core/fakes/in-memory-recovery-code-repository";
import { InMemorySessionRepository } from "@tests/core/fakes/in-memory-session-repository";
import { InMemoryUserRepository } from "@tests/core/fakes/in-memory-user-repository";
import { InMemoryVaultSlotRepository } from "@tests/core/fakes/in-memory-vault-slot-repository";
import { InMemoryWebAuthnCredentialRepository } from "@tests/core/fakes/in-memory-webauthn-credential-repository";
import { InMemoryWebAuthnSessionRepository } from "@tests/core/fakes/in-memory-webauthn-session-repository";
import { TEST_AUTH_SERVICE_CONFIG, TEST_WEBAUTHN_CONFIG } from "@tests/core/helpers/auth/config";
import type { CapturingEmailSender } from "@tests/core/helpers/auth/email";
import { createTestSecurityStores } from "@tests/core/helpers/auth/security";

export type InMemoryAuthRepos = {
  users: InMemoryUserRepository;
  sessions: InMemorySessionRepository;
  challenges: InMemoryMultifactorChallengeRepository;
  recoveryChallenges: InMemoryRecoveryChallengeRepository;
  recoveryCodes: InMemoryRecoveryCodeRepository;
  webauthnCredentials: InMemoryWebAuthnCredentialRepository;
  webauthnSessions: InMemoryWebAuthnSessionRepository;
  vaultSlots: InMemoryVaultSlotRepository;
};

export function createInMemoryAuthRepos(): InMemoryAuthRepos {
  return {
    users: new InMemoryUserRepository(),
    sessions: new InMemorySessionRepository(),
    challenges: new InMemoryMultifactorChallengeRepository(),
    recoveryChallenges: new InMemoryRecoveryChallengeRepository(),
    recoveryCodes: new InMemoryRecoveryCodeRepository(),
    webauthnCredentials: new InMemoryWebAuthnCredentialRepository(),
    webauthnSessions: new InMemoryWebAuthnSessionRepository(),
    vaultSlots: new InMemoryVaultSlotRepository(),
  };
}

export function wireInMemoryAuth(
  repos: InMemoryAuthRepos,
  emailSender: CapturingEmailSender,
  securityStores = createTestSecurityStores(),
  webauthnConfig = TEST_WEBAUTHN_CONFIG
): {
  auth: AuthService;
  vault: VaultService;
  passwordLockout: PasswordLockout;
} {
  const vault = new VaultService(repos.users, repos.vaultSlots, repos.webauthnCredentials);
  const auth = new AuthService({
    users: repos.users,
    sessions: repos.sessions,
    multifactorChallenges: repos.challenges,
    recoveryCodes: repos.recoveryCodes,
    recoveryChallenges: repos.recoveryChallenges,
    webauthnCredentials: repos.webauthnCredentials,
    webauthnSessions: repos.webauthnSessions,
    vault,
    emailSender,
    passwordLockout: securityStores.passwordLockout,
    rateLimiter: securityStores.rateLimiter,
    config: {
      ...TEST_AUTH_SERVICE_CONFIG,
      webauthn: webauthnConfig,
    },
  });

  return {
    auth,
    vault,
    passwordLockout: securityStores.passwordLockout,
  };
}
