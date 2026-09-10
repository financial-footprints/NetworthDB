import type { MultifactorServiceConfig } from "@core/domains/auth/modules/multifactor/services/multifactor-service";
import type { RecoveryServiceConfig } from "@core/domains/auth/modules/recovery/services/recovery-service";
import type { WebAuthnServiceConfig } from "@core/domains/auth/modules/webauthn/services/webauthn-service";
import type { AuthServiceConfig } from "@core/domains/auth/services/auth-service";

export const TEST_MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7);
export const TEST_SESSION_TTL_MS = 15 * 60 * 1000;
export const TEST_REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const TEST_MULTIFACTOR_CONFIG: MultifactorServiceConfig = {
  mfaEncryptionKey: TEST_MFA_ENCRYPTION_KEY,
  mfaChallengeTtl: 5 * 60 * 1000,
  mfaTotpSkew: 1,
  mfaMaxFailures: 5,
  mfaLockoutTtl: 15 * 60 * 1000,
  mfaRequiredRoles: [],
  appEnv: "local",
};

export const TEST_WEBAUTHN_CONFIG: WebAuthnServiceConfig = {
  rp: null,
  webauthnsessionTtl: 5 * 60 * 1000,
  mfaRequiredRoles: [],
  appEnv: "local",
};

export const TEST_RECOVERY_CONFIG: RecoveryServiceConfig = {
  appEnv: "local",
  recoveryAppBaseUrl: null,
  passwordTokenTtlMs: 60 * 60 * 1000,
  advancedTokenTtlMs: 30 * 60 * 1000,
};

export const TEST_AUTH_SERVICE_CONFIG: AuthServiceConfig = {
  sessionTtl: TEST_SESSION_TTL_MS,
  refreshTtl: TEST_REFRESH_TTL_MS,
  appEnv: "local",
  multifactor: TEST_MULTIFACTOR_CONFIG,
  webauthn: TEST_WEBAUTHN_CONFIG,
  recovery: TEST_RECOVERY_CONFIG,
};
