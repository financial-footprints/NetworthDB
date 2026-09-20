import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { dbPoolConfig } from "@database/config";
import { parseReadonlyDbEnv } from "@database/env";
import { createReadonlySqlExecutor } from "@database/operations/readonly/executor";
import { assertReadonlyPoolConnects } from "@tests/database/readonly/live-pool";
import type { Pool } from "pg";
import { Pool as PgPool } from "pg";

const USHER_ID = "00000000-0000-4000-8000-000000000003";
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";

describe("readonly sql executor (live)", () => {
  let pool: Pool | undefined;

  beforeAll(async () => {
    pool = new PgPool(dbPoolConfig(parseReadonlyDbEnv()));
    await assertReadonlyPoolConnects(pool);
  });

  afterAll(async () => {
    await pool?.end();
  });

  test("returns tenant-scoped transaction rows", async () => {
    if (!pool) {
      throw new Error("missing pool");
    }

    const sql = createReadonlySqlExecutor(pool);
    const result = await sql.executeSelect(
      `SELECT user_id::text FROM transactions LIMIT 10`,
      USHER_ID
    );

    expect(result.columns).toContain("user_id");
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.every((row) => row[0] === USHER_ID)).toBe(true);
  });

  test("scopes accounts to the session user only", async () => {
    if (!pool) {
      throw new Error("missing pool");
    }

    const sql = createReadonlySqlExecutor(pool);
    const crossTenant = await sql.executeSelect(
      `SELECT user_id::text FROM accounts WHERE user_id = '${USHER_ID}'`,
      ADMIN_ID
    );

    expect(crossTenant.rows.length).toBe(0);
  });

  test("rejects INSERT even when guard is bypassed via raw pool", async () => {
    if (!pool) {
      throw new Error("missing pool");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await client.query(`SELECT set_config('app.user_id', $1, true)`, [USHER_ID]);
      await expect(
        client.query(`
          INSERT INTO accounts (
            created_at, updated_at, opening_date, account_type, id, user_id,
            bank, label, account_number
          ) VALUES (NOW(), NOW(), '2020-01-01', 'bank', gen_random_uuid(), '${USHER_ID}', 'X', 'Y', '1')
        `)
      ).rejects.toThrow();
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});
