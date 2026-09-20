import { describeDatabaseSchema } from "@database/operations/describe/describe";
import { guardReadonlySql } from "@database/operations/readonly/guard";
import type { ReadonlySqlExecutor, ReadonlySqlResult } from "@database/operations/readonly/types";
import type { Pool } from "pg";

export type {
  DatabaseSchemaDescription,
  ReadonlySqlExecutor,
  ReadonlySqlResult,
} from "@database/operations/readonly/types";
export { describeDatabaseSchema };

const MAX_ROWS = 500;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUserId(userId: string): void {
  if (!UUID_PATTERN.test(userId)) {
    throw new Error("database.readonly.invalid-user-id");
  }
}

export function createReadonlySqlExecutor(pool: Pool): ReadonlySqlExecutor {
  return {
    describeSchema() {
      return describeDatabaseSchema();
    },

    async executeSelect(sql: string, userId: string): Promise<ReadonlySqlResult> {
      assertUserId(userId);
      const guardedSql = guardReadonlySql(sql);
      const client = await pool.connect();

      try {
        await client.query("BEGIN READ ONLY");
        await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId]);
        await client.query(`SET LOCAL statement_timeout = '15s'`);
        const result = await client.query({ text: guardedSql, values: [] });
        await client.query("COMMIT");

        const rows = result.rows.map((row) => Object.values(row));
        const truncated = rows.length > MAX_ROWS;
        const limitedRows = truncated ? rows.slice(0, MAX_ROWS) : rows;

        return {
          columns: result.fields.map((field) => field.name),
          rows: limitedRows,
          rowCount: result.rowCount ?? rows.length,
          truncated,
        };
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Connection may already be aborted.
        }
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
