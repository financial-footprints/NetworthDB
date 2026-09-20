import { createAuthCrypto } from "@ndb/auth";
import type { PasswordLockout, WebAuthnRpConfig } from "@ndb/core";
import { AuthService, VaultService } from "@ndb/core";
import {
  InMemoryMultifactorChallengeRepository,
  InMemoryRecoveryChallengeRepository,
  InMemoryRecoveryCodeRepository,
  InMemorySessionRepository,
  InMemoryUserRepository,
  InMemoryVaultSlotRepository,
  InMemoryWebAuthnCredentialRepository,
  InMemoryWebAuthnSessionRepository,
} from "@ndb/core/tests";
import {
  TEST_AUTH_SERVICE_CONFIG,
  TEST_MFA_SECRET,
  TEST_WEBAUTHN_CONFIG,
} from "@tests/auth/helpers/config";
import type { CapturingEmailSender } from "@tests/auth/helpers/email";
import { createTestSecurityStores } from "@tests/auth/helpers/security";

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

type WebauthnTestConfig = typeof TEST_WEBAUTHN_CONFIG & { rp?: WebAuthnRpConfig | null };

export function wireInMemoryAuth(
  repos: InMemoryAuthRepos,
  emailSender: CapturingEmailSender,
  securityStores = createTestSecurityStores(),
  webauthnConfig: WebauthnTestConfig = TEST_WEBAUTHN_CONFIG
): {
  auth: AuthService;
  vault: VaultService;
  passwordLockout: PasswordLockout;
} {
  const crypto = createAuthCrypto({
    mfaEncryptionKey: TEST_MFA_SECRET,
    webauthn: webauthnConfig.rp ?? null,
  });
  const vault = new VaultService(
    repos.users,
    repos.vaultSlots,
    repos.webauthnCredentials,
    crypto.password
  );
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
    crypto,
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
