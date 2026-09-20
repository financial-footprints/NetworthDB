import type { ApiConfig } from "@ndb/bootstrap";
import { API_PREFIX } from "@ndb/platform";
import {
  TEST_AUTH_RATE_WINDOW_MS,
  TEST_MFA_SECRET,
  TEST_MULTIFACTOR_CONFIG,
  TEST_RECOVERY_CONFIG,
  TEST_REFRESH_TTL,
  TEST_SESSION_TTL,
  TEST_WEBAUTHN_CONFIG,
} from "@tests/auth/helpers";

const TEST_FILESTORE_SECRET = Buffer.from(
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "hex"
);

export function fakeConfig(): ApiConfig {
  return {
    ttl: {
      session: TEST_SESSION_TTL,
      refresh: TEST_REFRESH_TTL,
    },
    auth: {
      webauthn: {
        rp: null,
        ttl: TEST_WEBAUTHN_CONFIG.ttl,
      },
      recovery: {
        recoveryAppBaseUrl: null,
        ttl: TEST_RECOVERY_CONFIG.ttl,
        email: { channel: "console" },
      },
      security: {
        rate: {
          limit: 1000,
          windowMs: TEST_AUTH_RATE_WINDOW_MS,
        },
        kvstore: {
          url: "redis://127.0.0.1:6379/0",
        },
      },
      multifactor: {
        encryptionKey: TEST_MFA_SECRET,
        totpSkew: TEST_MULTIFACTOR_CONFIG.mfaTotpSkew,
        ttl: TEST_MULTIFACTOR_CONFIG.ttl,
        lockout: {
          maxFailures: TEST_MULTIFACTOR_CONFIG.mfaMaxFailures,
        },
        requiredRoles: TEST_MULTIFACTOR_CONFIG.mfaRequiredRoles,
      },
    },
    app: {
      host: "127.0.0.1",
      port: 8000,
      url: API_PREFIX,
      logLevel: "info",
      environment: "local",
    },
    cors: {
      allowedOrigins: [],
    },
    encryption: {
      enabled: false,
      key: TEST_FILESTORE_SECRET,
    },
    jobs: {
      workers: 2,
    },
    advancedSecurity: {
      disabled: false,
      pipelineTrace: false,
      sensitiveBackups: false,
    },
    filestore: {
      path: "/tmp/networthdb-test",
    },
    backupMaxUploadBytes: 536_870_912,
  };
}
