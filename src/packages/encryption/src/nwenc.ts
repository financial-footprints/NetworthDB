import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { b64urlDecode, b64urlEncode } from "@encryption/base64url";

const DATA_KEY_LEN = 32;
const NWENC_MAGIC = Buffer.from("NWENC1\n");
const NONCE_LEN = 12;
const AUTH_TAG_LEN = 16;

export function isEncrypted(data: Buffer): boolean {
  return (
    data.length >= NWENC_MAGIC.length && data.subarray(0, NWENC_MAGIC.length).equals(NWENC_MAGIC)
  );
}

/** Internal seal; exported for test helpers only (not re-exported from package index). */
export function sealPlaintext(key: Buffer, plaintext: Buffer, nonce: Buffer): Buffer {
  if (key.length !== DATA_KEY_LEN) {
    throw new Error("encryption.nwenc.invalid.key-length");
  }
  if (nonce.length !== NONCE_LEN) {
    throw new Error("encryption.nwenc.invalid.nonce-length");
  }

  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const combined = Buffer.concat([ciphertext, cipher.getAuthTag()]);
  const packed = `${b64urlEncode(nonce)}.${b64urlEncode(combined)}`;

  return Buffer.concat([NWENC_MAGIC, Buffer.from(packed, "utf8")]);
}

export function encrypt(key: Buffer, plaintext: Buffer): Buffer {
  return sealPlaintext(key, plaintext, randomBytes(NONCE_LEN));
}

export function decrypt(key: Buffer, blob: Buffer): Buffer {
  if (!isEncrypted(blob)) {
    throw new Error("encryption.nwenc.invalid.not-nwenc1-blob");
  }
  if (key.length !== DATA_KEY_LEN) {
    throw new Error("encryption.nwenc.invalid.key-length");
  }

  const packed = blob.subarray(NWENC_MAGIC.length).toString("utf8");
  const separator = packed.indexOf(".");
  if (separator < 0) {
    throw new Error("encryption.nwenc.invalid.blob-format");
  }

  const nonce = b64urlDecode(packed.slice(0, separator));
  const combined = b64urlDecode(packed.slice(separator + 1));
  if (combined.length < AUTH_TAG_LEN) {
    throw new Error("encryption.nwenc.invalid.blob-format");
  }

  const ciphertext = combined.subarray(0, combined.length - AUTH_TAG_LEN);
  const tag = combined.subarray(combined.length - AUTH_TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("encryption.nwenc.decrypt.failed");
  }
}
