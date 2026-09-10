import type {
  MultifactorConfig,
  RecoveryConfig,
  SecurityConfig,
  WebAuthnConfig,
} from "@bootstrap/config/auth";
import { loadAuthConfig } from "@bootstrap/config/auth";
import { parseEnv } from "@bootstrap/config/env";
import type { AppEnv } from "@ndb/core";
import type { LogLevel } from "@ndb/logger";
import { API_PREFIX } from "@ndb/platform";

export type { AppEnv, MultifactorConfig, RecoveryConfig, SecurityConfig, WebAuthnConfig };

export type ApiConfig = {
  host: string;
  port: number;
  logLevel: LogLevel;
  apiPrefix: typeof API_PREFIX;
  environment: AppEnv;
  sessionTtl: number;
  refreshTtl: number;
  multifactor: MultifactorConfig;
  webauthn: WebAuthnConfig;
  recovery: RecoveryConfig;
  security: SecurityConfig;
  corsAllowOrigins: string[];
};

export function loadConfig(): ApiConfig {
  const env = parseEnv();
  const environment = env.ENVIRONMENT;

  if (environment === "production" && env.CORS_ALLOW_ORIGINS.includes("*")) {
    throw new Error(
      "bootstrap.config.env.cors-allow-origins.cannot-include-wildcard.when-production"
    );
  }

  if (
    environment === "production" &&
    (env.POSTGRES_SSLMODE.length === 0 || env.POSTGRES_SSLMODE === "disable")
  ) {
    throw new Error("bootstrap.config.env.postgres-sslmode.cannot-be-disable.when-production");
  }

  const auth = loadAuthConfig(env, environment);

  return {
    host: env.HOST,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    apiPrefix: API_PREFIX,
    environment,
    sessionTtl: env.SESSION_TTL,
    refreshTtl: env.REFRESH_TTL,
    multifactor: auth.multifactor,
    webauthn: auth.webauthn,
    recovery: auth.recovery,
    security: auth.security,
    corsAllowOrigins: env.CORS_ALLOW_ORIGINS,
  };
}
