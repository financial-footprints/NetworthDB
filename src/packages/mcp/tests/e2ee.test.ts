import { describe, expect, it } from "bun:test";
import { looksLikeE2eeBlob } from "@mcp/tools/e2ee";

const validBlob = `${"a".repeat(16)}.${"b".repeat(16)}`;

describe("looksLikeE2eeBlob", () => {
  it("accepts nonce.ciphertext with minimum segment lengths", () => {
    expect(looksLikeE2eeBlob(validBlob)).toBe(true);
    expect(looksLikeE2eeBlob(`  ${validBlob}  `)).toBe(true);
  });

  it("rejects plaintext and malformed blobs", () => {
    expect(looksLikeE2eeBlob("123456789012345")).toBe(false);
    expect(looksLikeE2eeBlob("short.bbbbbbbbbbbbbbbb")).toBe(false);
    expect(looksLikeE2eeBlob("aaaaaaaaaaaaaaaa.short")).toBe(false);
    expect(looksLikeE2eeBlob("no-dot")).toBe(false);
    expect(looksLikeE2eeBlob(".onlyciphertext")).toBe(false);
    expect(looksLikeE2eeBlob("onlynonce.")).toBe(false);
  });
});
