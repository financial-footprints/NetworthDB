import { describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { sealPlaintext } from "@encryption/nwenc";
import { decrypt, encrypt, isEncrypted } from "@ndb/encryption";

const TEST_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const FIXED_NONCE = Buffer.from("0123456789abcdef012345678", "hex");
const DATA_KEY_LEN = 32;

describe("@ndb/encryption", () => {
  test("encrypt and decrypt round-trip", () => {
    const key = randomBytes(DATA_KEY_LEN);
    const plaintext = Buffer.from('{"passwords":["secret"]}', "utf8");
    const blob = encrypt(key, plaintext);

    expect(isEncrypted(blob)).toBe(true);
    expect(decrypt(key, blob).toString("utf8")).toBe(plaintext.toString("utf8"));
  });

  test("encrypt rejects wrong key length", () => {
    expect(() => encrypt(Buffer.from("short"), Buffer.from("data"))).toThrow(
      "encryption.nwenc.invalid.key-length"
    );
  });

  test("decrypt rejects wrong key length", () => {
    const key = randomBytes(DATA_KEY_LEN);
    const blob = encrypt(key, Buffer.from("data"));
    expect(() => decrypt(Buffer.from("short"), blob)).toThrow(
      "encryption.nwenc.invalid.key-length"
    );
  });

  test("decrypt rejects non-NWENC1 blob", () => {
    const key = randomBytes(DATA_KEY_LEN);
    expect(() => decrypt(key, Buffer.from("plain"))).toThrow(
      "encryption.nwenc.invalid.not-nwenc1-blob"
    );
  });

  test("decrypt rejects corrupt NWENC1 blob", () => {
    const key = randomBytes(DATA_KEY_LEN);
    const blob = encrypt(key, Buffer.from("data"));
    blob[blob.length - 1] ^= 0xff;
    expect(() => decrypt(key, blob)).toThrow("encryption.nwenc.decrypt.failed");
  });

  test("isEncrypted edge cases", () => {
    expect(isEncrypted(Buffer.alloc(0))).toBe(false);
    expect(isEncrypted(Buffer.from("NWENC"))).toBe(false);
    expect(isEncrypted(Buffer.from("NWENC1\n"))).toBe(true);
  });

  test("fixed nonce round-trip", () => {
    const key = Buffer.from(TEST_KEY_HEX, "hex");
    const plaintext = Buffer.from("hello", "utf8");
    const blob = sealPlaintext(key, plaintext, FIXED_NONCE);
    expect(decrypt(key, blob).toString("utf8")).toBe("hello");
  });
});
