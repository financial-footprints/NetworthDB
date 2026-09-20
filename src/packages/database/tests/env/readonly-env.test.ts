import { afterEach, describe, expect, test } from "bun:test";
import { parseReadonlyDbEnv } from "@database/env";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("parseReadonlyDbEnv", () => {
  test("maps RO user and password with shared connection fields", () => {
    process.env.POSTGRES_HOST = "localhost";
    process.env.POSTGRES_PORT = "5451";
    process.env.POSTGRES_DATABASE = "networthdb";
    process.env.POSTGRES_SSLMODE = "disable";
    process.env.POSTGRES_RO_USER = "networthdb_readonly";
    process.env.POSTGRES_RO_PASSWORD = "ro-secret";

    const config = parseReadonlyDbEnv();
    expect(config.username).toBe("networthdb_readonly");
    expect(config.password).toBe("ro-secret");
    expect(config.database).toBe("networthdb");
    expect(config.host).toBe("localhost");
    expect(config.port).toBe(5451);
    expect(config.ssl).toBe(false);
  });

  test("throws when RO fields are missing", () => {
    delete process.env.POSTGRES_RO_USER;
    delete process.env.POSTGRES_RO_PASSWORD;

    expect(() => parseReadonlyDbEnv()).toThrow("database.config.env.invalid.fields");
  });
});
