import { describe, expect, it } from "bun:test";
import { SessionStore } from "@mcp/auth/session-store";
import { assembleMcpTools } from "@mcp/tools/query";
import { formatToolDescription } from "@mcp/tools/schema";
import { SERVICE_CATALOG_BY_NAME, SERVICE_CATALOG_ENTRIES } from "@mcp/tools/schema/inventory";

const stubSql = {
  describeSchema: () => ({ overview: "", tables: [], enums: [] }),
  executeSelect: async () => ({ columns: [], rows: [], rowCount: 0, truncated: false }),
};

const DISAMBIGUATION_SNIPPETS: Record<string, string[]> = {
  transactions_batch: ["transactions_bulk", "import"],
  transactions_bulk: ["transactions_batch", "transactions_patch"],
  sql_query: ["transactions_list", "accounts_list"],
  transactions_list: ["sql_query", "transactions_summary"],
  rules_test: ["rules_apply", "immediate"],
  rules_apply: ["rules_test", "jobs_wait"],
};

describe("SERVICE_CATALOG_ENTRIES", () => {
  it("every entry has non-empty summary, relevance, and returns", () => {
    for (const entry of SERVICE_CATALOG_ENTRIES) {
      expect(entry.summary.trim().length).toBeGreaterThan(0);
      expect(entry.relevance.trim().length).toBeGreaterThan(0);
      expect(entry.returns.trim().length).toBeGreaterThan(0);
      if (entry.instead !== undefined) {
        expect(entry.instead.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("formatToolDescription includes Auth, Use when, and Returns for every entry", () => {
    for (const entry of SERVICE_CATALOG_ENTRIES) {
      const text = formatToolDescription(entry);
      expect(text).toContain("Auth:");
      expect(text).toContain("Use when:");
      expect(text).toContain("Returns:");
      if (entry.instead) {
        expect(text).toContain("Prefer instead:");
      }
    }
  });

  it("disambiguation tools mention the right alternatives", () => {
    for (const [name, needles] of Object.entries(DISAMBIGUATION_SNIPPETS)) {
      const entry = SERVICE_CATALOG_BY_NAME.get(name);
      if (!entry) {
        throw new Error(`missing catalog entry ${name}`);
      }
      const text = formatToolDescription(entry).toLowerCase();
      for (const needle of needles) {
        expect(text).toContain(needle.toLowerCase());
      }
    }
  });
});

describe("assembleMcpTools descriptions", () => {
  it("match formatToolDescription for each registered tool", () => {
    const session = new SessionStore({ apiOrigin: "http://127.0.0.1:8000" });
    const tools = assembleMcpTools({ session, sql: stubSql });
    for (const tool of tools) {
      const entry = SERVICE_CATALOG_BY_NAME.get(tool.name);
      if (!entry) {
        throw new Error(`missing catalog entry ${tool.name}`);
      }
      expect(tool.description).toBe(formatToolDescription(entry));
    }
  });
});
