import type { DbConfig } from "@database/types";
import type { PoolConfig } from "pg";

export function dbPoolConfig(config: DbConfig, overrides: Partial<PoolConfig> = {}): PoolConfig {
  const poolConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    max: config.poolMax,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    ...overrides,
  };

  if (config.ssl) {
    poolConfig.ssl = config.ssl;
  }

  return poolConfig;
}
