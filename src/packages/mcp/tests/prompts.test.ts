import { describe, expect, it } from "bun:test";
import { McpAuthError } from "@mcp/auth/gate";
import { SessionStore } from "@mcp/auth/session-store";
import { createMcpPrompts } from "@mcp/prompts";
import { PROMPT_CATALOG_ENTRIES } from "@mcp/prompts/catalog";
import { requireNamed } from "@tests/mcp/require-named";

describe("createMcpPrompts", () => {
  it("registers all catalog prompts", () => {
    const session = new SessionStore({ apiOrigin: "http://127.0.0.1:8000" });
    const names = createMcpPrompts({ session })
      .map((prompt) => prompt.name)
      .sort();
    const expected = PROMPT_CATALOG_ENTRIES.map((entry) => entry.name).sort();
    expect(names).toEqual(expected);
    expect(names).toHaveLength(10);
  });

  it("rejects monthly_review without a session", async () => {
    const session = new SessionStore({ apiOrigin: "http://127.0.0.1:8000" });
    const monthlyReview = requireNamed(createMcpPrompts({ session }), "monthly_review");
    await expect(
      monthlyReview.handler({ from: "2025-01-01", to: "2025-01-31" })
    ).rejects.toBeInstanceOf(McpAuthError);
  });
});
