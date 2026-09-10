import { dbPoolConfig } from "@database/config";
import * as schema from "@database/schema/index";
import type { DbClient, DbClientHandle, DbConfig } from "@database/types";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export type CreateDbClientOptions = {
  config: DbConfig;
};

export function createDbClient(options: CreateDbClientOptions): DbClientHandle {
  const pool = new Pool(dbPoolConfig(options.config));

  return {
    client: drizzle(pool, { schema }),
    close: async () => {
      await pool.end();
    },
  };
}

export async function pingDb(db: DbClient): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}
