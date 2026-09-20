import type {
  MultifactorConfig,
  RecoveryConfig,
  SecurityConfig,
  WebAuthnConfig,
} from "@bootstrap/config/auth";
import { loadAuthConfig } from "@bootstrap/config/auth";
import { parseEnv } from "@bootstrap/config/env";
import type { AppEnv } from "@ndb/core";
import { parseDbEnv, parseStorageEnv } from "@ndb/database/env";
import type { LogLevel } from "@ndb/logger";
import { API_PREFIX } from "@ndb/platform";

export type { AppEnv, MultifactorConfig, RecoveryConfig, SecurityConfig, WebAuthnConfig };

export type EncryptionConfig = {
  enabled: boolean;
  key: Buffer | null;
};

export type JobsConfig = {
  workers: number;
};

export type AdvancedSecurityConfig = {
  disabled: boolean;
  pipelineTrace: boolean;
  sensitiveBackups: boolean;
};

export type ApiConfig = {
  ttl: {
    session: number;
    refresh: number;
  };
  auth: {
    webauthn: WebAuthnConfig;
    recovery: RecoveryConfig;
    security: SecurityConfig;
    multifactor: MultifactorConfig;
  };
  app: {
    host: string;
    port: number;
    url: typeof API_PREFIX;
    logLevel: LogLevel;
    environment: AppEnv;
  };
  cors: {
    allowedOrigins: string[];
  };
  encryption: EncryptionConfig;
  jobs: JobsConfig;
  advancedSecurity: AdvancedSecurityConfig;
  filestore: {
    path: string;
  };
  backupMaxUploadBytes: number;
};

export function loadConfig(): ApiConfig {
  const env = parseEnv();
  const environment = env.ENVIRONMENT;
  const storage = parseStorageEnv();

  if (environment === "production" && env.CORS_ALLOW_ORIGINS.includes("*")) {
    throw new Error(
      "bootstrap.config.env.cors-allow-origins.cannot-include-wildcard.when-production"
    );
  }

  if (environment === "production") {
    const db = parseDbEnv();
    if (db.ssl === false) {
      throw new Error("bootstrap.config.env.postgres-sslmode.cannot-be-disable.when-production");
    }
  }

  const auth = loadAuthConfig(env, environment);

  const filestorePath =
    env.FILESTORE_PATH && env.FILESTORE_PATH.length > 0 ? env.FILESTORE_PATH : "/tmp/networthdb";
  if (environment === "production" && (!env.FILESTORE_PATH || env.FILESTORE_PATH.length === 0)) {
    throw new Error("bootstrap.config.env.production-required.not-found.FILESTORE_PATH");
  }

  return {
    ttl: {
      session: env.SESSION_TTL,
      refresh: env.REFRESH_TTL,
    },
    auth: {
      webauthn: auth.webauthn,
      recovery: auth.recovery,
      security: auth.security,
      multifactor: auth.multifactor,
    },
    app: {
      host: env.HOST,
      port: env.PORT,
      url: API_PREFIX,
      logLevel: env.LOG_LEVEL,
      environment,
    },
    cors: {
      allowedOrigins: env.CORS_ALLOW_ORIGINS,
    },
    encryption: {
      enabled: storage.encryption.enabled,
      key: storage.encryption.key,
    },
    jobs: {
      workers: env.JOBS_MAX_WORKERS,
    },
    advancedSecurity: {
      disabled: env.DISABLE_ADVANCED_SECURITY,
      pipelineTrace: env.DISABLE_ADVANCED_SECURITY || environment === "local",
      sensitiveBackups: env.DISABLE_ADVANCED_SECURITY,
    },
    filestore: {
      path: filestorePath,
    },
    backupMaxUploadBytes: env.BACKUP_MAX_UPLOAD_BYTES,
  };
}
