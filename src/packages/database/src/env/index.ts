import { DB_CONNECTION_TIMEOUT_MS, DB_POOL_MAX, parseDbEnv } from "@database/env/db";
import { APP_ENVS, type AppEnv } from "@ndb/core";
import { decodeKey } from "@ndb/encryption";
import { z } from "zod";

export { DB_CONNECTION_TIMEOUT_MS, DB_POOL_MAX, parseDbEnv };

function emptyToUndefined(value: unknown): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}

const storageEnvSchema = z.object({
  ENVIRONMENT: z.enum(APP_ENVS),
  FILESTORE_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
});

export type StorageEnvConfig = {
  environment: AppEnv;
  encryption: {
    enabled: boolean;
    key: Buffer | null;
  };
};

export function parseStorageEnv(): StorageEnvConfig {
  const parsed = storageEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`database.config.env.invalid.fields.${fields}`);
  }

  const { ENVIRONMENT, FILESTORE_SECRET } = parsed.data;

  let masterKey: Buffer | null = null;
  if (FILESTORE_SECRET !== undefined) {
    masterKey = decodeKey(FILESTORE_SECRET);
  } else if (ENVIRONMENT === "production") {
    throw new Error("bootstrap.config.env.production-required.not-found.FILESTORE_SECRET");
  }

  return {
    environment: ENVIRONMENT,
    encryption: {
      enabled: ENVIRONMENT !== "local",
      key: masterKey,
    },
  };
}
