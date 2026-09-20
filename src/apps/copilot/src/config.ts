import { APP_ENVS, type AppEnv } from "@ndb/core";
import { type DbConfig, parseReadonlyDbEnv } from "@ndb/database/env";
import { z } from "zod";

const configSchema = z.object({
  ENVIRONMENT: z.enum(APP_ENVS).default("local"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  API_ORIGIN: z.string().url(),
  MCP_TRANSPORT: z.enum(["stdio", "http"]).default("stdio"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().positive().default(8002),
  NDB_USERNAME: z.string().optional(),
  NDB_PASSWORD: z.string().optional(),
  NDB_TOTP: z.string().optional(),
});

export type CopilotConfig = {
  environment: AppEnv;
  logLevel: "debug" | "info" | "warn" | "error";
  apiOrigin: string;
  transport: "stdio" | "http";
  host: string;
  port: number;
  readonlyDb: DbConfig;
  startupLogin?: {
    username: string;
    password: string;
    totp?: string;
  };
};

export function loadCopilotConfig(): CopilotConfig {
  const parsed = configSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`copilot.config.env.invalid.fields.${fields}`);
  }

  const {
    NDB_USERNAME,
    NDB_PASSWORD,
    NDB_TOTP,
    API_ORIGIN,
    ENVIRONMENT,
    LOG_LEVEL,
    MCP_TRANSPORT,
    HOST,
    PORT,
  } = parsed.data;

  let startupLogin: CopilotConfig["startupLogin"];
  if (NDB_USERNAME && NDB_PASSWORD) {
    startupLogin = {
      username: NDB_USERNAME,
      password: NDB_PASSWORD,
      totp: NDB_TOTP,
    };
  }

  return {
    environment: ENVIRONMENT,
    logLevel: LOG_LEVEL,
    apiOrigin: API_ORIGIN,
    transport: MCP_TRANSPORT,
    host: HOST,
    port: PORT,
    readonlyDb: parseReadonlyDbEnv(),
    startupLogin,
  };
}
