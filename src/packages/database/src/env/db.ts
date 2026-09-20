import type { DbConfig } from "@database/types";

export type { DbConfig } from "@database/types";

import { z } from "zod";

export const DB_POOL_MAX = 10;
export const DB_CONNECTION_TIMEOUT_MS = 30_000;

const connectionEnvSchema = z.object({
  POSTGRES_HOST: z.string().min(1),
  POSTGRES_PORT: z.coerce.number().int().positive(),
  POSTGRES_DATABASE: z.string().min(1),
  POSTGRES_SSLMODE: z.string().min(1),
});

const dbEnvSchema = connectionEnvSchema.extend({
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
});

const readonlyDbEnvSchema = connectionEnvSchema.extend({
  POSTGRES_RO_USER: z.string().min(1),
  POSTGRES_RO_PASSWORD: z.string().min(1),
});

function sslFromMode(sslMode: string): DbConfig["ssl"] {
  if (sslMode === "disable") {
    return false;
  }

  return { rejectUnauthorized: sslMode !== "require" };
}

export function parseReadonlyDbEnv(): DbConfig {
  const parsed = readonlyDbEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`database.config.env.invalid.fields.${fields}`);
  }

  const {
    POSTGRES_HOST,
    POSTGRES_PORT,
    POSTGRES_RO_USER,
    POSTGRES_RO_PASSWORD,
    POSTGRES_DATABASE,
    POSTGRES_SSLMODE,
  } = parsed.data;

  return {
    host: POSTGRES_HOST,
    port: POSTGRES_PORT,
    username: POSTGRES_RO_USER,
    password: POSTGRES_RO_PASSWORD,
    database: POSTGRES_DATABASE,
    ssl: sslFromMode(POSTGRES_SSLMODE),
    poolMax: DB_POOL_MAX,
    connectionTimeoutMs: DB_CONNECTION_TIMEOUT_MS,
  };
}

export function parseDbEnv(): DbConfig {
  const parsed = dbEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`database.config.env.invalid.fields.${fields}`);
  }

  const {
    POSTGRES_HOST,
    POSTGRES_PORT,
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_DATABASE,
    POSTGRES_SSLMODE,
  } = parsed.data;

  return {
    host: POSTGRES_HOST,
    port: POSTGRES_PORT,
    username: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    database: POSTGRES_DATABASE,
    ssl: sslFromMode(POSTGRES_SSLMODE),
    poolMax: DB_POOL_MAX,
    connectionTimeoutMs: DB_CONNECTION_TIMEOUT_MS,
  };
}
