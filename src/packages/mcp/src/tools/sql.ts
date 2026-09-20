import { requireSession } from "@mcp/auth/gate";
import type { SessionStore } from "@mcp/auth/session-store";
import type { McpToolDefinition } from "@mcp/helpers";
import { bindMethod } from "@mcp/tools/helpers";
import { emptyArgsSchema } from "@mcp/tools/schema";
import { SERVICE_CATALOG_BY_NAME } from "@mcp/tools/schema/inventory";
import type { ReadonlySqlExecutor } from "@ndb/database/readonly";
import { z } from "zod";

export const SQL_TOOL_NAMES = ["schema_describe", "sql_query"] as const;

const sqlQuerySchema = z.object({
  sql: z.string().min(1).describe("SQL to run as-is. Add LIMIT yourself for large tables."),
});

function catalogEntry(name: string) {
  const entry = SERVICE_CATALOG_BY_NAME.get(name);
  if (!entry) {
    throw new Error(`mcp.tools.sql.missing-catalog.${name}`);
  }
  return entry;
}

export function createSqlTools(options: {
  session: SessionStore;
  sql: ReadonlySqlExecutor;
}): McpToolDefinition[] {
  const { session, sql } = options;

  return [
    bindMethod({
      catalog: catalogEntry("schema_describe"),
      schema: emptyArgsSchema,
      invoke: async () => {
        requireSession(session);
        return sql.describeSchema();
      },
    }),
    bindMethod({
      catalog: catalogEntry("sql_query"),
      schema: sqlQuerySchema,
      invoke: async (input) => {
        const user = requireSession(session);
        return sql.executeSelect(input.sql, user.id);
      },
    }),
  ];
}
