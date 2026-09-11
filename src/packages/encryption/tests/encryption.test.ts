import { describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import {
  DATA_KEY_LEN,
  decodeKey,
  decrypt,
  decryptString,
  encrypt,
  encryptString,
  isEncrypted,
} from "@ndb/encryption";

const TEST_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("@ndb/encryption", () => {
  test("encrypt and decrypt round-trip", () => {
    const key = randomBytes(DATA_KEY_LEN);
    const plaintext = Buffer.from('{"passwords":["secret"]}', "utf8");
    const blob = encrypt(key, plaintext);

    expect(isEncrypted(blob)).toBe(true);
    expect(decrypt(key, blob).toString("utf8")).toBe(plaintext.toString("utf8"));
  });

  test("encryptString and decryptString round-trip", () => {
    const key = randomBytes(DATA_KEY_LEN);
    const blob = encryptString(key, "totp-secret-value");
    expect(decryptString(key, blob)).toBe("totp-secret-value");
  });

  test("decodeKey accepts hex", () => {
    const key = decodeKey(TEST_KEY_HEX);
    expect(key.length).toBe(DATA_KEY_LEN);
  });

  test("decodeKey rejects wrong length", () => {
    expect(() => decodeKey("abcd")).toThrow("encryption.key.invalid-length");
  });

  test("decrypt rejects non-NWENC1 blob", () => {
    const key = randomBytes(DATA_KEY_LEN);
    expect(() => decrypt(key, Buffer.from("plain"))).toThrow(
      "encryption.nwenc.invalid.not-nwenc1-blob"
    );
  });
});
