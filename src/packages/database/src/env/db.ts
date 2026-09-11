import type { DbConfig } from "@database/types";
import { z } from "zod";

export const DB_POOL_MAX = 4;
export const DB_CONNECTION_TIMEOUT_MS = 30_000;

const dbEnvSchema = z.object({
  POSTGRES_HOST: z.string().min(1),
  POSTGRES_PORT: z.coerce.number().int().positive(),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_DATABASE: z.string().min(1),
  POSTGRES_SSLMODE: z.string().min(1),
});

function sslFromMode(sslMode: string): DbConfig["ssl"] {
  if (sslMode === "disable") {
    return false;
  }

  return { rejectUnauthorized: sslMode !== "require" };
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
