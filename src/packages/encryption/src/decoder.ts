import { b64urlDecode } from "@encryption/base64url";

const SECRET_KEY_LEN = 32;
const HEX_KEY_LEN = SECRET_KEY_LEN * 2;

export function decodeSecretKey(raw: string): Buffer {
  const value = raw.trim();
  if (value.length === 0) {
    throw new Error("encryption.key.empty");
  }

  const key = isHexKey(value) ? Buffer.from(value, "hex") : b64urlDecode(value);
  if (key.length !== SECRET_KEY_LEN) {
    throw new Error("encryption.key.invalid-length");
  }

  return key;
}

function isHexKey(value: string): boolean {
  return value.length === HEX_KEY_LEN && /^[0-9a-fA-F]+$/.test(value);
}
