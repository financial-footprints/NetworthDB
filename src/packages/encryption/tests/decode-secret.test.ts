import { describe, expect, test } from "bun:test";
import { decodeSecretKey } from "@ndb/encryption";

const HEX_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const B64URL_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("decodeSecretKey", () => {
  test("accepts a 32-byte hex key", () => {
    const key = decodeSecretKey(HEX_KEY);
    expect(key.length).toBe(32);
    expect(key.toString("hex")).toBe(HEX_KEY);
  });

  test("accepts a 32-byte base64url key", () => {
    const key = decodeSecretKey(B64URL_KEY);
    expect(key.length).toBe(32);
  });

  test("rejects an empty value", () => {
    expect(() => decodeSecretKey("   ")).toThrow("encryption.key.empty");
  });

  test("rejects the wrong length", () => {
    expect(() => decodeSecretKey("0123456789abcdef")).toThrow("encryption.key.invalid-length");
  });
});
