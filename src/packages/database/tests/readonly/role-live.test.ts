import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { dbPoolConfig } from "@database/config";
import { parseReadonlyDbEnv } from "@database/env";
import { assertReadonlyPoolConnects } from "@tests/database/readonly/live-pool";
import type { Pool } from "pg";
import { Pool as PgPool } from "pg";

const USHER_ID = "00000000-0000-4000-8000-000000000003";
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";

describe("readonly role (live)", () => {
  let pool: Pool | undefined;

  beforeAll(async () => {
    pool = new PgPool(dbPoolConfig(parseReadonlyDbEnv()));
    await assertReadonlyPoolConnects(pool);
  });

  afterAll(async () => {
    await pool?.end();
  });

  test("INSERT into accounts is denied", async () => {
    if (!pool) {
      throw new Error("missing pool");
    }

    await expect(
      pool.query(`
        INSERT INTO accounts (
          created_at, updated_at, opening_date, account_type, id, user_id,
          bank, label, account_number
        ) VALUES (NOW(), NOW(), '2020-01-01', 'bank', gen_random_uuid(), '${USHER_ID}', 'X', 'Y', '1')
      `)
    ).rejects.toThrow();
  });

  test("password_hash and secrets columns are not selectable", async () => {
    if (!pool) {
      throw new Error("missing pool");
    }

    await expect(pool.query(`SELECT password_hash FROM users LIMIT 1`)).rejects.toThrow();
    await expect(pool.query(`SELECT secrets FROM accounts LIMIT 1`)).rejects.toThrow();
  });

  test("auth_sessions is not granted", async () => {
    if (!pool) {
      throw new Error("missing pool");
    }

    await expect(pool.query(`SELECT 1 FROM auth_sessions LIMIT 1`)).rejects.toThrow();
  });

  test("accounts without app.user_id returns zero rows", async () => {
    if (!pool) {
      throw new Error("missing pool");
    }

    const result = await pool.query(`SELECT count(*)::int AS count FROM accounts`);
    expect(result.rows[0]?.count).toBe(0);
  });

  test("SET LOCAL app.user_id scopes accounts to one tenant", async () => {
    if (!pool) {
      throw new Error("missing pool");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL app.user_id = '${USHER_ID}'`);
      const usherResult = await client.query(`SELECT user_id::text FROM accounts`);
      await client.query("COMMIT");

      const usherUserIds = usherResult.rows.map((row) => row.user_id as string);
      expect(usherUserIds.length).toBeGreaterThan(0);
      expect(usherUserIds.every((id) => id === USHER_ID)).toBe(true);

      await client.query("BEGIN");
      await client.query(`SET LOCAL app.user_id = '${ADMIN_ID}'`);
      const crossTenant = await client.query(
        `SELECT user_id::text FROM accounts WHERE user_id = '${USHER_ID}'`
      );
      await client.query("COMMIT");
      expect(crossTenant.rows.length).toBe(0);
    } finally {
      client.release();
    }
  });
});
