import type { ApiConfig, ApiServices, HealthService } from "@ndb/bootstrap";
import { UserService } from "@ndb/core";
import { API_PREFIX } from "@ndb/platform";
import {
  CapturingEmailSender,
  TEST_AUTH_RATE_WINDOW_MS,
  TEST_MULTIFACTOR_CONFIG,
  TEST_RECOVERY_CONFIG,
  TEST_REFRESH_TTL_MS,
  TEST_SESSION_TTL_MS,
  TEST_WEBAUTHN_CONFIG,
} from "@tests/core/helpers/auth";
import { createInMemoryAuthRepos, wireInMemoryAuth } from "@tests/core/helpers/auth/wiring";

export function fakeConfig(): ApiConfig {
  return {
    host: "127.0.0.1",
    port: 8000,
    logLevel: "info",
    apiPrefix: API_PREFIX,
    environment: "local",
    sessionTtl: TEST_SESSION_TTL_MS,
    refreshTtl: TEST_REFRESH_TTL_MS,
    multifactor: {
      mfaEncryptionKey: TEST_MULTIFACTOR_CONFIG.mfaEncryptionKey,
      mfaChallengeTtl: TEST_MULTIFACTOR_CONFIG.mfaChallengeTtl,
      mfaTotpSkew: TEST_MULTIFACTOR_CONFIG.mfaTotpSkew,
      mfaMaxFailures: TEST_MULTIFACTOR_CONFIG.mfaMaxFailures,
      mfaLockoutTtl: TEST_MULTIFACTOR_CONFIG.mfaLockoutTtl,
      mfaRequiredRoles: TEST_MULTIFACTOR_CONFIG.mfaRequiredRoles,
    },
    webauthn: TEST_WEBAUTHN_CONFIG,
    recovery: {
      recoveryAppBaseUrl: null,
      passwordTokenTtlMs: TEST_RECOVERY_CONFIG.passwordTokenTtlMs,
      advancedTokenTtlMs: TEST_RECOVERY_CONFIG.advancedTokenTtlMs,
      email: { channel: "console" },
    },
    security: {
      authRateLimit: 1000,
      authRateWindowMs: TEST_AUTH_RATE_WINDOW_MS,
      kvstoreUrl: "redis://127.0.0.1:6379/0",
    },
    corsAllowOrigins: [],
  };
}

export function fakeServices(): ApiServices {
  const repos = createInMemoryAuthRepos();
  const emailSender = new CapturingEmailSender();
  const { auth, vault } = wireInMemoryAuth(repos, emailSender);

  return {
    health: {
      check: async () => ({ ok: true }),
    } as HealthService,
    user: new UserService(repos.users, auth, "local"),
    vault,
    auth,
  };
}
