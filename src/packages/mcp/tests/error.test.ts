import { describe, expect, test } from "bun:test";
import { formatMcpError } from "@mcp/error";

describe("formatMcpError database hint", () => {
  test("appends local migrate hint for connection failures", () => {
    const error = new Error("ECONNREFUSED");
    const formatted = formatMcpError(error, "local");
    expect(formatted).toContain("POSTGRES_*");
    expect(formatted).toContain("@ndb/database migrate");
  });

  test("omits hint outside local", () => {
    const error = new Error("ECONNREFUSED");
    expect(formatMcpError(error, "production")).toBe("Error: ECONNREFUSED");
  });
});
