import type { Pool } from "pg";

const READONLY_CONNECT_HINT =
  "database.readonly.live.connect-failed: run `bun run --filter @ndb/database migrate:test` and ensure POSTGRES_RO_* in src/apps/api/.env.tests matches the granted role password.";

export async function assertReadonlyPoolConnects(pool: Pool): Promise<void> {
  try {
    await pool.query("SELECT 1");
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    if (code === "28P01") {
      throw new Error(READONLY_CONNECT_HINT);
    }
    throw error;
  }
}
