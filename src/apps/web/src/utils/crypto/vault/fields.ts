import {
  decodeBase64url,
  decryptAESGCM,
  encodeBase64url,
  encryptAESGCM,
} from "@web/utils/crypto/aes";

const BLOB_SEPARATOR = ".";

export function packE2EEBlob(nonce: string, ciphertext: string): string {
  return `${nonce}${BLOB_SEPARATOR}${ciphertext}`;
}

export function unpackE2EEBlob(blob: string): {
  nonce: string;
  ciphertext: string;
} {
  const trimmed = blob.trim();
  if (!trimmed) {
    throw new Error("e2ee blob empty");
  }
  const dot = trimmed.indexOf(BLOB_SEPARATOR);
  if (dot <= 0 || dot === trimmed.length - 1) {
    throw new Error("e2ee blob invalid");
  }
  const nonce = trimmed.slice(0, dot);
  const ciphertext = trimmed.slice(dot + 1);
  if (!nonce || !ciphertext || ciphertext.includes(BLOB_SEPARATOR)) {
    throw new Error("e2ee blob invalid");
  }
  return { nonce, ciphertext };
}

/** Minimum base64url length for a sealed 12-byte nonce or AES-GCM ciphertext with auth tag. */
const MIN_SEALED_SEGMENT_LEN = 16;

export function looksLikeE2eeBlob(blob: string): boolean {
  const trimmed = blob.trim();
  try {
    const { nonce, ciphertext } = unpackE2EEBlob(trimmed);
    return nonce.length >= MIN_SEALED_SEGMENT_LEN && ciphertext.length >= MIN_SEALED_SEGMENT_LEN;
  } catch {
    return false;
  }
}

export async function sealField(dek: CryptoKey, plaintext: string): Promise<string> {
  const sealed = await encryptAESGCM(dek, new TextEncoder().encode(plaintext));
  return packE2EEBlob(encodeBase64url(sealed.nonce), encodeBase64url(sealed.ciphertext));
}

export async function openField(dek: CryptoKey, blob: string): Promise<string> {
  const trimmed = blob.trim();
  if (!looksLikeE2eeBlob(trimmed)) {
    return trimmed;
  }
  try {
    const { nonce, ciphertext } = unpackE2EEBlob(trimmed);
    const plaintext = await decryptAESGCM(dek, decodeBase64url(ciphertext), decodeBase64url(nonce));
    return new TextDecoder().decode(plaintext);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "e2ee blob empty" || error.message === "e2ee blob invalid")
    ) {
      return trimmed;
    }
    throw error;
  }
}
