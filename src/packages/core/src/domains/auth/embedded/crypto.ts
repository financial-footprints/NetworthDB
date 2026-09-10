import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const TOKEN_BYTE_LENGTH = 32;

export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTE_LENGTH).toString("hex");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export type SecretBox = {
  ciphertext: string;
  nonce: string;
};

function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function encryptSecret(plaintext: string, key: Buffer): SecretBox {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([encrypted, authTag]);

  return {
    ciphertext: toBase64Url(ciphertext),
    nonce: toBase64Url(iv),
  };
}

export function decryptSecret(box: SecretBox, key: Buffer): string {
  const ciphertext = fromBase64Url(box.ciphertext);
  const iv = fromBase64Url(box.nonce);
  const authTag = ciphertext.subarray(ciphertext.length - AUTH_TAG_LENGTH);
  const encrypted = ciphertext.subarray(0, ciphertext.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
