import { describe, expect, test } from "bun:test";
import { createTokenDigest } from "@auth/crypto/tokens";

describe("createTokenDigest", () => {
  test("generates random hex tokens", () => {
    const tokens = createTokenDigest();
    const first = tokens.randomHex(32);
    const second = tokens.randomHex(32);
    expect(first).toHaveLength(64);
    expect(second).toHaveLength(64);
    expect(first).not.toBe(second);
  });

  test("hashes session tokens consistently", () => {
    const tokens = createTokenDigest();
    const hash = tokens.sha256Hex("session-token");
    expect(hash).toHaveLength(64);
    expect(tokens.sha256Hex("session-token")).toBe(hash);
  });
});
