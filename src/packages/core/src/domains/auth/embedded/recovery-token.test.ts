import { describe, expect, test } from "bun:test";
import {
  generateRecoveryToken,
  hashRecoverySecret,
} from "@core/domains/auth/embedded/recovery-token";
import type { TokenDigest } from "@core/ports/auth";

const testTokens: TokenDigest = {
  randomHex(byteLength: number) {
    return "b".repeat(byteLength * 2);
  },
  randomBase64Url(_byteLength: number) {
    return "token-value";
  },
  sha256Hex(value: string) {
    return `hash:${value}`;
  },
};

describe("recovery token helpers", () => {
  test("generates recovery tokens", () => {
    expect(generateRecoveryToken(testTokens)).toBe("token-value");
  });

  test("hashes recovery secrets", () => {
    expect(hashRecoverySecret(testTokens, "abc-def")).toBe("hash:ABCDEF");
  });
});
