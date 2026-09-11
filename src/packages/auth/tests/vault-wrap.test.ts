import { describe, expect, test } from "bun:test";
import { VaultSlot } from "@core/domains/user/modules/vault/entities/vault-slot";

describe("VaultSlot.wrap", () => {
  test("packWrap and unpackWrap round-trip", () => {
    const packed = VaultSlot.packWrap("abc", "def");
    expect(VaultSlot.unpackWrap(packed)).toEqual({ nonce: "abc", ciphertext: "def" });
  });

  test("unpackWrap rejects invalid blobs", () => {
    expect(() => VaultSlot.unpackWrap("")).toThrow();
    expect(() => VaultSlot.unpackWrap("no-separator")).toThrow();
  });
});
