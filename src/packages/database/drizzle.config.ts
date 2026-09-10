import { parseDbEnv } from "@database/env";
import { defineConfig } from "drizzle-kit";

const db = parseDbEnv();

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: db.host,
    port: db.port,
    database: db.database,
    user: db.username,
    password: db.password,
    ssl: db.ssl === false ? false : db.ssl,
  },
});
