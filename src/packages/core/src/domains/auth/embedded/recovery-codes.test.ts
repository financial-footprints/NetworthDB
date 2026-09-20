import { describe, expect, test } from "bun:test";
import {
  formatDashedRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoverySecret,
} from "@core/domains/auth/embedded/recovery-codes";
import type { TokenDigest } from "@core/ports/auth";

const testTokens: TokenDigest = {
  randomHex(byteLength: number) {
    return "a".repeat(byteLength * 2);
  },
  randomBase64Url(byteLength: number) {
    return "a".repeat(byteLength);
  },
  sha256Hex(value: string) {
    return `hash:${value}`;
  },
};

describe("recovery codes", () => {
  test("normalizes recovery secrets", () => {
    expect(normalizeRecoverySecret(" ab-cd ")).toBe("ABCD");
  });

  test("formats dashed recovery codes", () => {
    expect(formatDashedRecoveryCode("ABCDEFGHIJKLMNOP")).toBe("ABCD-EFGH-IJKL-MNOP");
  });

  test("generates recovery codes", () => {
    const generated = generateRecoveryCodes(testTokens);
    expect(generated.plain).toHaveLength(10);
    expect(generated.hashes).toHaveLength(10);
    expect(hashRecoveryCode(testTokens, generated.plain[0])).toBe(generated.hashes[0]);
  });
});
