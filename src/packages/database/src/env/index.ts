import { APP_ENVS, type AppEnv } from "@ndb/core";
import { decodeSecretKey } from "@ndb/encryption";
import { z } from "zod";

export {
  DB_POOL_MAX,
  parseDbEnv,
  parseReadonlyDbEnv,
} from "@database/env/db";
export type { DbConfig } from "@database/types";

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

type StorageEnvConfig = {
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
    masterKey = decodeSecretKey(FILESTORE_SECRET);
  } else if (ENVIRONMENT === "production") {
    throw new Error("database.config.env.production-required.not-found.FILESTORE_SECRET");
  }

  return {
    environment: ENVIRONMENT,
    encryption: {
      enabled: ENVIRONMENT !== "local",
      key: masterKey,
    },
  };
}
