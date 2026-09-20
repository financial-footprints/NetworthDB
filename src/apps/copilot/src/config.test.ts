import { afterEach, describe, expect, test } from "bun:test";
import { loadCopilotConfig } from "@copilot/config";

const BASE_ENV: Record<string, string> = {
  API_ORIGIN: "http://127.0.0.1:8000",
  ENVIRONMENT: "local",
  LOG_LEVEL: "info",
  POSTGRES_HOST: "localhost",
  POSTGRES_PORT: "5451",
  POSTGRES_DATABASE: "networthdb",
  POSTGRES_SSLMODE: "disable",
  POSTGRES_RO_USER: "networthdb_readonly",
  POSTGRES_RO_PASSWORD: "networthdb_readonly",
};

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function withEnv(overrides: Record<string, string | undefined>, fn: () => void): void {
  process.env = { ...ORIGINAL_ENV };
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  fn();
}

describe("loadCopilotConfig", () => {
  test("happy path maps API origin and defaults", () => {
    withEnv({}, () => {
      const config = loadCopilotConfig();
      expect(config.apiOrigin).toBe("http://127.0.0.1:8000");
      expect(config.environment).toBe("local");
      expect(config.logLevel).toBe("info");
      expect(config.transport).toBe("stdio");
      expect(config.host).toBe("127.0.0.1");
      expect(config.port).toBe(8002);
      expect(config.readonlyDb.username).toBe("networthdb_readonly");
    });
  });

  test("throws when API_ORIGIN is missing", () => {
    withEnv({ API_ORIGIN: undefined }, () => {
      expect(() => loadCopilotConfig()).toThrow("copilot.config.env.invalid.fields");
    });
  });

  test("startup login only when username and password are set", () => {
    withEnv({ NDB_USERNAME: "usher", NDB_PASSWORD: "secret", NDB_TOTP: "123456" }, () => {
      const config = loadCopilotConfig();
      expect(config.startupLogin).toEqual({
        username: "usher",
        password: "secret",
        totp: "123456",
      });
    });

    withEnv({ NDB_USERNAME: "usher" }, () => {
      const config = loadCopilotConfig();
      expect(config.startupLogin).toBeUndefined();
    });

    withEnv({ NDB_PASSWORD: "secret" }, () => {
      const config = loadCopilotConfig();
      expect(config.startupLogin).toBeUndefined();
    });
  });
});
