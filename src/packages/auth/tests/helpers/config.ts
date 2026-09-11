import type {
  AuthServiceConfig,
  MultifactorServiceConfig,
  RecoveryServiceConfig,
  WebAuthnServiceConfig,
} from "@ndb/core";

export const TEST_MFA_SECRET = Buffer.alloc(32, 7);

export const TEST_TTL = {
  session: 15 * 60 * 1000,
  refresh: 7 * 24 * 60 * 60 * 1000,
  challenge: 5 * 60 * 1000,
  lockout: 15 * 60 * 1000,
  webauthnSession: 5 * 60 * 1000,
  recoveryPassword: 60 * 60 * 1000,
  recoveryAdvanced: 30 * 60 * 1000,
} as const;

export const TEST_SESSION_TTL = TEST_TTL.session;
export const TEST_REFRESH_TTL = TEST_TTL.refresh;

export const TEST_MULTIFACTOR_CONFIG: MultifactorServiceConfig = {
  mfaTotpSkew: 1,
  mfaMaxFailures: 5,
  mfaRequiredRoles: [],
  ttl: {
    challenge: TEST_TTL.challenge,
    lockout: TEST_TTL.lockout,
  },
  appEnv: "local",
};

export const TEST_WEBAUTHN_CONFIG: WebAuthnServiceConfig = {
  ttl: {
    session: TEST_TTL.webauthnSession,
  },
  mfaRequiredRoles: [],
  appEnv: "local",
};

export const TEST_RECOVERY_CONFIG: RecoveryServiceConfig = {
  appEnv: "local",
  recoveryAppBaseUrl: null,
  ttl: {
    password: TEST_TTL.recoveryPassword,
    advanced: TEST_TTL.recoveryAdvanced,
  },
};

export const TEST_AUTH_SERVICE_CONFIG: AuthServiceConfig = {
  ttl: {
    session: TEST_TTL.session,
    refresh: TEST_TTL.refresh,
  },
  appEnv: "local",
  multifactor: TEST_MULTIFACTOR_CONFIG,
  webauthn: TEST_WEBAUTHN_CONFIG,
  recovery: TEST_RECOVERY_CONFIG,
};
