import { join } from "node:path";
import { dbPoolConfig } from "@ndb/database/config";
import { parseDbEnv } from "@ndb/database/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const migrationsFolder = join(import.meta.dir, "../../src/packages/database/drizzle/migrations");

const pool = new Pool(dbPoolConfig(parseDbEnv()));
const db = drizzle(pool);

try {
  await migrate(db, { migrationsFolder });
  console.log("deploy.migrate.completed");
} finally {
  await pool.end();
}
