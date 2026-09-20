import { describe, expect, it } from "bun:test";
import { McpAuthError } from "@mcp/auth/gate";
import { SessionStore } from "@mcp/auth/session-store";
import { DOMAIN_TOOL_NAMES } from "@mcp/tools/index";
import { assembleMcpTools } from "@mcp/tools/query";
import { SERVICE_CATALOG_ENTRIES } from "@mcp/tools/schema/inventory";
import { createSqlTools, SQL_TOOL_NAMES } from "@mcp/tools/sql";
import { API } from "@ndb/platform";
import { requireNamed } from "@tests/mcp/require-named";

const API_ORIGIN = "http://127.0.0.1:8000";

const stubSql = {
  describeSchema: () => ({ overview: "", tables: [], enums: [] }),
  executeSelect: async () => ({ columns: [], rows: [], rowCount: 0, truncated: false }),
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function authenticatedSession() {
  const session = new SessionStore({
    apiOrigin: API_ORIGIN,
    fetchImpl: async (url, init) => {
      if (url.endsWith(API.auth.session.login) && init?.method === "POST") {
        return jsonResponse(200, {
          data: { sessionToken: "t", refreshToken: "r", expiresIn: 3600 },
        });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, {
          data: { id: "u1", username: "usher", role: "user", multifactorEnabled: false },
        });
      }
      throw new Error(`unexpected ${url}`);
    },
  });
  await session.login({ username: "usher", password: "x" });
  return session;
}

describe("assembleMcpTools", () => {
  it("registers full catalog without sql when unauthenticated", () => {
    const session = new SessionStore({ apiOrigin: "http://127.0.0.1:8000" });
    const names = assembleMcpTools({ session })
      .map((tool) => tool.name)
      .sort();
    const catalogNames = SERVICE_CATALOG_ENTRIES.map((entry) => entry.name).sort();
    const withoutSql = catalogNames.filter(
      (name) => !SQL_TOOL_NAMES.includes(name as (typeof SQL_TOOL_NAMES)[number])
    );
    expect(names).toEqual(withoutSql);
    expect(names).toContain("accounts_list");
    expect(names).not.toContain("sql_query");
  });

  it("domain tool without session throws McpAuthError", async () => {
    const session = new SessionStore({ apiOrigin: "http://127.0.0.1:8000" });
    const tools = assembleMcpTools({ session });
    const list = requireNamed(tools, "accounts_list");
    await expect(list.handler({})).rejects.toThrow(McpAuthError);
  });

  it("includes SQL and domain tools when executor is wired and session is authenticated", async () => {
    const session = await authenticatedSession();
    const names = assembleMcpTools({ session, sql: stubSql })
      .map((tool) => tool.name)
      .sort();
    expect(names).toEqual(
      ["auth_login", "auth_status", "ping", ...SQL_TOOL_NAMES, ...DOMAIN_TOOL_NAMES].sort()
    );
  });

  it("registers SQL tools only through createSqlTools", () => {
    const session = new SessionStore({ apiOrigin: "http://127.0.0.1:8000" });
    const sqlTools = createSqlTools({ session, sql: stubSql });
    expect(sqlTools.map((tool) => tool.name)).toEqual([...SQL_TOOL_NAMES]);
  });

  it("registers every service catalog tool when authenticated with sql", async () => {
    const session = await authenticatedSession();
    const names = assembleMcpTools({ session, sql: stubSql })
      .map((tool) => tool.name)
      .sort();
    const catalogNames = SERVICE_CATALOG_ENTRIES.map((entry) => entry.name).sort();
    expect(names).toEqual(catalogNames);
  });
});
