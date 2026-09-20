import { dbPoolConfig } from "@database/config";
import { parseDbEnv, parseReadonlyDbEnv } from "@database/env";
import { grant } from "@database/operations/readonly/grant";
import { Pool } from "pg";

const rwConfig = parseDbEnv();
const roConfig = parseReadonlyDbEnv();
const pool = new Pool(dbPoolConfig(rwConfig, { max: 1 }));

try {
  await grant(pool, {
    roleName: roConfig.username,
    databaseName: rwConfig.database,
    password: roConfig.password,
  });
} finally {
  await pool.end();
}
