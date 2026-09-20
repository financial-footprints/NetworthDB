import { describe, expect, it } from "bun:test";
import { McpAuthError } from "@mcp/auth/gate";
import { SessionStore } from "@mcp/auth/session-store";
import { createMcpResources } from "@mcp/resources";
import { RESOURCE_CATALOG_ENTRIES } from "@mcp/resources/catalog";
import { requireNamed } from "@tests/mcp/require-named";

const stubSql = {
  describeSchema: () => ({
    overview: "test",
    tables: [{ name: "transactions", summary: "", columns: [], foreignKeys: [] }],
    enums: [],
  }),
  executeSelect: async () => ({ columns: [], rows: [], rowCount: 0, truncated: false }),
};

describe("createMcpResources", () => {
  it("registers catalog URIs", () => {
    const session = new SessionStore({ apiOrigin: "http://127.0.0.1:8000" });
    const names = createMcpResources({ session, sql: stubSql }).map((resource) => resource.name);
    expect(names).toContain("docs_howto");
    expect(names).toContain("schema");
    expect(names).toContain("me");
    expect(RESOURCE_CATALOG_ENTRIES.some((entry) => entry.uri === "ndb://docs/howto")).toBe(true);
  });

  it("allows docs_howto without a session", async () => {
    const session = new SessionStore({ apiOrigin: "http://127.0.0.1:8000" });
    const docs = requireNamed(createMcpResources({ session, sql: stubSql }), "docs_howto");
    const payload = await docs.read(new URL("ndb://docs/howto"), {});
    expect(typeof payload).toBe("string");
    expect(payload).toContain("schema_describe");
  });

  it("rejects me without a session", async () => {
    const session = new SessionStore({ apiOrigin: "http://127.0.0.1:8000" });
    const me = requireNamed(createMcpResources({ session, sql: stubSql }), "me");
    await expect(me.read(new URL("ndb://me"), {})).rejects.toBeInstanceOf(McpAuthError);
  });

  it("rejects schema without a session", async () => {
    const session = new SessionStore({ apiOrigin: "http://127.0.0.1:8000" });
    const schema = requireNamed(createMcpResources({ session, sql: stubSql }), "schema");
    await expect(schema.read(new URL("ndb://schema"), {})).rejects.toBeInstanceOf(McpAuthError);
  });
});
