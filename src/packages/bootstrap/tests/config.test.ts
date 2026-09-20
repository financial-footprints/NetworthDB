import { describe, expect, test } from "bun:test";
import { loadConfig } from "@bootstrap/config/api";
import { durationMs, envCommaSeparatedList, envUrl, getEnv, parseEnv } from "@bootstrap/config/env";
import { z } from "zod";

const BASE_ENV: Record<string, string> = {
  HOST: "127.0.0.1",
  PORT: "8000",
  LOG_LEVEL: "info",
  ENVIRONMENT: "production",
  POSTGRES_USER: "networthdb",
  POSTGRES_PASSWORD: "networthdb",
  POSTGRES_HOST: "localhost",
  POSTGRES_PORT: "5451",
  POSTGRES_DATABASE: "networthdb",
  POSTGRES_SSLMODE: "require",
  SESSION_TTL: "15m",
  REFRESH_TTL: "720h",
  MFA_CHALLENGE_TTL: "5m",
  MFA_SECRET: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  MFA_LOCKOUT_TTL: "15m",
  MFA_TOTP_SKEW: "1",
  MFA_MAX_FAILURES: "5",
  MFA_REQUIRED_ROLES: "",
  AUTH_RATE_LIMIT: "20",
  AUTH_RATE_WINDOW: "60s",
  RECOVERY_PASSWORD_TOKEN_TTL: "1h",
  RECOVERY_ADVANCED_TOKEN_TTL: "30m",
  CORS_ALLOW_ORIGINS: "",
  WEBAUTHN_RP_DISPLAY_NAME: "NetworthDB",
  WEBAUTHN_RP_ID: "example.com",
  WEBAUTHN_RP_ORIGINS: "https://example.com",
  EMAIL_CHANNEL: "smtp",
  SMTP_HOST: "localhost",
  SMTP_PORT: "587",
  SMTP_FROM: "noreply@example.com",
  KVSTORE_URL: "redis://127.0.0.1:6379/0",
  FILESTORE_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  FILESTORE_PATH: "/tmp/networthdb-test",
};

function withEnv(overrides: Record<string, string>, fn: () => void): void {
  const previous = { ...process.env };
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    process.env[key] = value;
  }

  try {
    fn();
  } finally {
    for (const key of Object.keys({ ...BASE_ENV, ...overrides })) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

describe("bootstrap env schema", () => {
  test("durationMs accepts ms, s, m, and h", () => {
    expect(durationMs.parse("500ms")).toBe(500);
    expect(durationMs.parse("30s")).toBe(30_000);
    expect(durationMs.parse("5m")).toBe(5 * 60 * 1000);
    expect(durationMs.parse("2h")).toBe(2 * 60 * 60 * 1000);
  });

  test("durationMs rejects invalid values", () => {
    expect(() => durationMs.parse("5x")).toThrow("bootstrap.config.env.invalid-duration.value.5x");
  });

  test("optional recovery token TTL defaults when unset", () => {
    withEnv({}, () => {
      delete process.env.RECOVERY_PASSWORD_TOKEN_TTL;
      expect(parseEnv().RECOVERY_PASSWORD_TOKEN_TTL).toBe(60 * 60 * 1000);
    });
  });

  test("optional recovery token TTL parses duration when set", () => {
    withEnv({ RECOVERY_PASSWORD_TOKEN_TTL: "15m" }, () => {
      expect(parseEnv().RECOVERY_PASSWORD_TOKEN_TTL).toBe(15 * 60 * 1000);
    });
  });

  test("AUTH_RATE_LIMIT rejects non-positive values", () => {
    withEnv({ AUTH_RATE_LIMIT: "0" }, () => {
      expect(() => parseEnv()).toThrow("bootstrap.config.env.invalid-positive-int.value.0");
    });
  });

  test("MFA_TOTP_SKEW cannot exceed 10", () => {
    withEnv({ MFA_TOTP_SKEW: "11" }, () => {
      expect(() => loadConfig()).toThrow(
        "bootstrap.config.env.invalid-non-negative-int.max.MFA_TOTP_SKEW.11"
      );
    });
  });

  test("JOBS_MAX_WORKERS defaults to 10 when unset", () => {
    withEnv({}, () => {
      delete process.env.JOBS_MAX_WORKERS;
      expect(parseEnv().JOBS_MAX_WORKERS).toBe(10);
    });
  });

  test("JOBS_MAX_WORKERS rejects non-positive values", () => {
    withEnv({ JOBS_MAX_WORKERS: "0" }, () => {
      expect(() => parseEnv()).toThrow("bootstrap.config.env.invalid-positive-int.value.0");
    });
  });
});

describe("bootstrap env helpers", () => {
  test("getEnv required throws when value is undefined", () => {
    withEnv({}, () => {
      const env = parseEnv();
      delete (env as { SMTP_HOST?: string }).SMTP_HOST;

      expect(() => getEnv(env, "SMTP_HOST", z.string(), "required")).toThrow(
        "bootstrap.config.env.required.not-found.SMTP_HOST"
      );
    });
  });

  test("getEnv required returns parsed value when defined", () => {
    withEnv({}, () => {
      const env = parseEnv();
      expect(getEnv(env, "SMTP_HOST", z.string(), "required")).toBe("localhost");
    });
  });

  test("getEnv required throws when MFA_SECRET is undefined in local", () => {
    withEnv({ ENVIRONMENT: "local" }, () => {
      const env = parseEnv();
      delete (env as { MFA_SECRET?: string }).MFA_SECRET;

      expect(() => getEnv(env, "MFA_SECRET", z.string(), "required")).toThrow(
        "bootstrap.config.env.required.not-found.MFA_SECRET"
      );
    });
  });

  test("getEnv required-in-production returns null for FILESTORE_PATH when undefined and not production", () => {
    withEnv({ ENVIRONMENT: "local" }, () => {
      const env = parseEnv();
      delete (env as { FILESTORE_PATH?: string }).FILESTORE_PATH;

      expect(getEnv(env, "FILESTORE_PATH", z.string(), "required-in-production", false)).toBeNull();
    });
  });

  test("getEnv required-in-production throws when FILESTORE_PATH is undefined in production", () => {
    withEnv({}, () => {
      const env = parseEnv();
      delete (env as { FILESTORE_PATH?: string }).FILESTORE_PATH;

      expect(() =>
        getEnv(env, "FILESTORE_PATH", z.string(), "required-in-production", true)
      ).toThrow("bootstrap.config.env.production-required.not-found.FILESTORE_PATH");
    });
  });

  test("envCommaSeparatedList returns empty array for undefined", () => {
    expect(envCommaSeparatedList.parse(undefined)).toEqual([]);
  });

  test("envCommaSeparatedList returns empty array for empty string", () => {
    expect(envCommaSeparatedList.parse("")).toEqual([]);
  });

  test("envCommaSeparatedList trims and filters empty entries", () => {
    expect(envCommaSeparatedList.parse(" admin , , user ")).toEqual(["admin", "user"]);
  });

  test("envCommaSeparatedList parses comma-separated values", () => {
    expect(envCommaSeparatedList.parse("a, b, c")).toEqual(["a", "b", "c"]);
  });

  test("getEnv optional returns null when undefined", () => {
    withEnv({}, () => {
      const env = parseEnv();
      delete (env as { RECOVERY_APP_BASE_URL?: string }).RECOVERY_APP_BASE_URL;

      expect(getEnv(env, "RECOVERY_APP_BASE_URL", envUrl, "optional")).toBeNull();
    });
  });

  test("getEnv optional normalizes trailing slashes on URLs", () => {
    withEnv({ RECOVERY_APP_BASE_URL: "http://localhost:3000/" }, () => {
      const env = parseEnv();
      expect(getEnv(env, "RECOVERY_APP_BASE_URL", envUrl, "optional")).toBe(
        "http://localhost:3000"
      );
    });
  });

  test("getEnv optional preserves origin and path on URLs", () => {
    withEnv({ RECOVERY_APP_BASE_URL: "https://example.com/app/" }, () => {
      const env = parseEnv();
      expect(getEnv(env, "RECOVERY_APP_BASE_URL", envUrl, "optional")).toBe(
        "https://example.com/app"
      );
    });
  });

  test("envUrl rejects invalid values", () => {
    expect(() => envUrl.parse("not-a-url")).toThrow(
      "bootstrap.config.env.invalid-url.value.not-a-url"
    );
  });

  test("envUrl rejects non-http protocols", () => {
    expect(() => envUrl.parse("ftp://example.com")).toThrow(
      "bootstrap.config.env.invalid-url.protocol.ftp"
    );
  });

  test("envUrl rejects query strings and fragments", () => {
    expect(() => envUrl.parse("http://localhost:3000?token=abc")).toThrow(
      "bootstrap.config.env.invalid-url.unsupported-component"
    );
  });
});

describe("bootstrap config guards", () => {
  test("production rejects POSTGRES_SSLMODE=disable", () => {
    withEnv({ POSTGRES_SSLMODE: "disable" }, () => {
      expect(() => loadConfig()).toThrow(
        "bootstrap.config.env.postgres-sslmode.cannot-be-disable.when-production"
      );
    });
  });

  test("loadConfig throws when MFA_SECRET is missing in local", () => {
    withEnv({ ENVIRONMENT: "local" }, () => {
      delete process.env.MFA_SECRET;

      expect(() => loadConfig()).toThrow("bootstrap.config.env.required.not-found.MFA_SECRET");
    });
  });

  test("loadConfig succeeds when FILESTORE_SECRET is missing in local", () => {
    withEnv({ ENVIRONMENT: "local" }, () => {
      delete process.env.FILESTORE_SECRET;

      expect(loadConfig().encryption.key).toBeNull();
    });
  });

  test("encryption is disabled for local environment", () => {
    withEnv({ ENVIRONMENT: "local" }, () => {
      expect(loadConfig().encryption.enabled).toBe(false);
    });
  });

  test("encryption is enabled for production environment", () => {
    withEnv({ ENVIRONMENT: "production" }, () => {
      expect(loadConfig().encryption.enabled).toBe(true);
    });
  });

  test("jobs config loads max workers from env", () => {
    withEnv({ JOBS_MAX_WORKERS: "4" }, () => {
      expect(loadConfig().jobs.workers).toBe(4);
    });
  });

  test("advanced security config disables sensitive backups and enables pipeline trace when kill switch is on", () => {
    withEnv({ DISABLE_ADVANCED_SECURITY: "true" }, () => {
      const config = loadConfig();
      expect(config.advancedSecurity.disabled).toBe(true);
      expect(config.advancedSecurity.sensitiveBackups).toBe(true);
      expect(config.advancedSecurity.pipelineTrace).toBe(true);
    });
  });

  test("pipeline trace is enabled in local even when kill switch is off", () => {
    withEnv({ ENVIRONMENT: "local", DISABLE_ADVANCED_SECURITY: "false" }, () => {
      expect(loadConfig().advancedSecurity.pipelineTrace).toBe(true);
    });
  });

  test("filestore path loads from env in production", () => {
    withEnv({ FILESTORE_PATH: "/data/networthdb" }, () => {
      expect(loadConfig().filestore.path).toBe("/data/networthdb");
    });
  });

  test("filestore path defaults in local when unset", () => {
    withEnv({ ENVIRONMENT: "local" }, () => {
      delete process.env.FILESTORE_PATH;
      expect(loadConfig().filestore.path).toBe("/tmp/networthdb");
    });
  });

  test("production requires FILESTORE_PATH", () => {
    withEnv({}, () => {
      delete process.env.FILESTORE_PATH;
      expect(() => loadConfig()).toThrow(
        "bootstrap.config.env.production-required.not-found.FILESTORE_PATH"
      );
    });
  });
});
