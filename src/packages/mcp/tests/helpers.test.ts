import { describe, expect, test } from "bun:test";
import { McpAuthError } from "@mcp/auth/gate";
import { formatMcpError } from "@mcp/error";
import { toMcpJson } from "@mcp/helpers";

describe("toMcpJson", () => {
  test("round-trips plain objects", () => {
    expect(toMcpJson({ ok: true })).toEqual({ ok: true });
  });
});

describe("formatMcpError", () => {
  test("maps read-only Postgres code 42501", () => {
    const error = Object.assign(new Error("permission denied"), { code: "42501" });
    expect(formatMcpError(error)).toBe(
      "Permission denied: this database connection is read-only. Do not retry write operations."
    );
  });

  test("maps McpAuthError", () => {
    expect(formatMcpError(new McpAuthError())).toBe("Error: mcp.auth.unauthenticated");
  });
});
