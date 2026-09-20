import { describe, expect, test } from "bun:test";
import { createMcpHttpHandler } from "@mcp/http";
import { API } from "@ndb/platform";

/**
 * SQL tenant isolation: @ndb/database/tests/readonly/executor-live.test.ts
 * SQL statement guard: @ndb/database/tests/readonly/guard.test.ts
 * MCP SQL gate without session: sql.test.ts; resources: resources.test.ts
 */

const API_ORIGIN = "http://127.0.0.1:8000";
const MCP_URL = "http://127.0.0.1:8002/mcp";

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

function mePayload() {
  return {
    id: "user-1",
    username: "usher",
    role: "user",
    multifactorEnabled: false,
  };
}

describe("createMcpHttpHandler", () => {
  test("GET /mcp without Authorization returns 401 and does not call users/me", async () => {
    let meCalls = 0;
    const handler = createMcpHttpHandler({
      apiOrigin: API_ORIGIN,
      sql: stubSql,
      fetchImpl: async (url) => {
        if (url.endsWith(API.users.me.get)) {
          meCalls += 1;
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    });

    const response = await handler(new Request(MCP_URL, { method: "GET" }));
    expect(response.status).toBe(401);
    expect(meCalls).toBe(0);
    expect(response.headers.get("WWW-Authenticate")).toContain("Bearer");
  });

  test("GET /mcp with Bearer and valid me is not rejected as unauthorized", async () => {
    const handler = createMcpHttpHandler({
      apiOrigin: API_ORIGIN,
      sql: stubSql,
      fetchImpl: async (url, init) => {
        if (url.endsWith(API.users.me.get) && init?.method === "GET") {
          return jsonResponse(200, { data: mePayload() });
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    });

    const response = await handler(
      new Request(MCP_URL, {
        method: "GET",
        headers: { Authorization: "Bearer session-from-api" },
      })
    );
    expect(response.status).not.toBe(401);
  });

  test("GET /health does not require auth", async () => {
    const handler = createMcpHttpHandler({ apiOrigin: API_ORIGIN });
    const response = await handler(new Request("http://127.0.0.1:8002/health"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
