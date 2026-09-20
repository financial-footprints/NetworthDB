import { describe, expect, it } from "bun:test";
import { McpAuthError } from "@mcp/auth/gate";
import { SessionStore } from "@mcp/auth/session-store";
import { createSqlTools } from "@mcp/tools/sql";
import { requireNamed } from "@tests/mcp/require-named";

const stubSql = {
  describeSchema: () => ({ overview: "x", tables: [], enums: [] }),
  executeSelect: async () => ({ columns: ["n"], rows: [[1]], rowCount: 1, truncated: false }),
};

describe("createSqlTools", () => {
  it("rejects sql_query without a session", async () => {
    const session = new SessionStore({ apiOrigin: "http://127.0.0.1:8000" });
    const sqlQuery = requireNamed(createSqlTools({ session, sql: stubSql }), "sql_query");
    await expect(sqlQuery.handler({ sql: "SELECT 1" })).rejects.toBeInstanceOf(McpAuthError);
  });

  it("rejects schema_describe without a session", async () => {
    const session = new SessionStore({ apiOrigin: "http://127.0.0.1:8000" });
    const schemaDescribe = requireNamed(
      createSqlTools({ session, sql: stubSql }),
      "schema_describe"
    );
    await expect(schemaDescribe.handler({})).rejects.toBeInstanceOf(McpAuthError);
    await expect(schemaDescribe.handler({})).rejects.toThrow("mcp.auth.unauthenticated");
  });
});
