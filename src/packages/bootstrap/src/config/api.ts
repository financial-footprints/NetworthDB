import {
  optionalEnv,
  parseCorsOrigins,
  requireDuration,
  requireEnv,
  requirePort,
} from "@bootstrap/config/env";
import type { LogLevel } from "@ndb/logger";
import { API_PREFIX } from "@ndb/platform";

export type AppEnv = "local" | "production";

function requireLogLevel(): LogLevel {
  const value = requireEnv("LOG_LEVEL");

  if (value !== "debug" && value !== "info" && value !== "warn" && value !== "error") {
    throw new Error(`bootstrap.config.env.invalid-log-level.value.${value}`);
  }

  return value;
}

export type ApiConfig = {
  host: string;
  port: number;
  logLevel: LogLevel;
  apiPrefix: typeof API_PREFIX;
  environment: AppEnv;
  postgres: {
    user: string;
    password: string;
    host: string;
    port: number;
    database: string;
    sslMode: string;
  };
  sessionTtlMs: number;
  refreshTtlMs: number;
  mfaChallengeTtlMs: number;
  corsAllowOrigins: string[];
};

function requireEnvironment(): AppEnv {
  const value = requireEnv("ENVIRONMENT");

  if (value !== "local" && value !== "production") {
    throw new Error(`bootstrap.config.env.invalid-environment.value.${value}`);
  }

  return value;
}

export function loadConfig(): ApiConfig {
  const environment = requireEnvironment();
  const corsAllowOrigins = parseCorsOrigins(optionalEnv("CORS_ALLOW_ORIGINS"));

  if (environment === "production" && corsAllowOrigins.includes("*")) {
    throw new Error(
      "bootstrap.config.env.cors-allow-origins.cannot-include-wildcard.when-production"
    );
  }

  return {
    host: requireEnv("HOST"),
    port: requirePort("PORT"),
    logLevel: requireLogLevel(),
    apiPrefix: API_PREFIX,
    environment,
    postgres: {
      user: requireEnv("POSTGRES_USER"),
      password: requireEnv("POSTGRES_PASSWORD"),
      host: requireEnv("POSTGRES_HOST"),
      port: requirePort("POSTGRES_PORT"),
      database: requireEnv("POSTGRES_DATABASE"),
      sslMode: requireEnv("POSTGRES_SSLMODE"),
    },
    sessionTtlMs: requireDuration("SESSION_TTL"),
    refreshTtlMs: requireDuration("REFRESH_TTL"),
    mfaChallengeTtlMs: requireDuration("MFA_CHALLENGE_TTL"),
    corsAllowOrigins,
  };
}
