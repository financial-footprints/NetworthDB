import type { ApiConfig, ApiServices } from "@ndb/bootstrap";
import { API_PREFIX } from "@ndb/platform";

export function fakeConfig(): ApiConfig {
  return {
    host: "127.0.0.1",
    port: 8000,
    logLevel: "info",
    apiPrefix: API_PREFIX,
    environment: "local",
    postgres: {
      user: "networthdb",
      password: "networthdb",
      host: "localhost",
      port: 5451,
      database: "networthdb",
      sslMode: "disable",
    },
    sessionTtlMs: 15 * 60 * 1000,
    refreshTtlMs: 720 * 60 * 60 * 1000,
    mfaChallengeTtlMs: 5 * 60 * 1000,
    corsAllowOrigins: [],
  };
}

export function fakeServices(): ApiServices {
  return {
    health: async () => ({ ok: true }),
  };
}
