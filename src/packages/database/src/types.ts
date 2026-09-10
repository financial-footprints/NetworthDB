import type * as schema from "@database/schema/index";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export type DbConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean | { rejectUnauthorized: boolean };
  poolMax: number;
  connectionTimeoutMs: number;
};

export type DbClient = NodePgDatabase<typeof schema>;

export type DbClientHandle = {
  client: DbClient;
  close: () => Promise<void>;
};
