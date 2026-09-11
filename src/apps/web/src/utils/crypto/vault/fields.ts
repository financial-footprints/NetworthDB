import {
  decodeBase64url,
  decryptAESGCM,
  encodeBase64url,
  encryptAESGCM,
} from "@web/utils/crypto/aes";
import { packE2EEBlob, unpackE2EEBlob } from "@web/utils/crypto/vault/blob";

export async function sealField(dek: CryptoKey, plaintext: string): Promise<string> {
  const sealed = await encryptAESGCM(dek, new TextEncoder().encode(plaintext));
  return packE2EEBlob(encodeBase64url(sealed.nonce), encodeBase64url(sealed.ciphertext));
}

/** Minimum base64url length for a sealed 12-byte nonce or AES-GCM ciphertext with auth tag. */
const MIN_SEALED_SEGMENT_LEN = 16;

export async function openField(dek: CryptoKey, blob: string): Promise<string> {
  const trimmed = blob.trim();
  try {
    const { nonce, ciphertext } = unpackE2EEBlob(trimmed);
    if (nonce.length < MIN_SEALED_SEGMENT_LEN || ciphertext.length < MIN_SEALED_SEGMENT_LEN) {
      return trimmed;
    }
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

export function hasE2EEVault(vaultInitialized: boolean | null | undefined): boolean {
  return Boolean(vaultInitialized);
}
