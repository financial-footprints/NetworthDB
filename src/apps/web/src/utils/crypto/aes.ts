/** Web Crypto expects ArrayBuffer-backed views, not generic ArrayBufferLike. */
export function asBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function encodeBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

export function decodeBase64url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encryptAESGCM(
  key: CryptoKey,
  plaintext: Uint8Array
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  const nonce = randomBytes(12);
  return encryptAESGCMWithNonce(key, plaintext, nonce);
}

async function encryptAESGCMWithNonce(
  key: CryptoKey,
  plaintext: Uint8Array,
  nonce: Uint8Array
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asBufferSource(nonce) },
    key,
    asBufferSource(plaintext)
  );
  return { ciphertext: new Uint8Array(ciphertext), nonce };
}

export async function decryptAESGCM(
  key: CryptoKey,
  ciphertext: Uint8Array,
  nonce: Uint8Array
): Promise<Uint8Array> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asBufferSource(nonce) },
    key,
    asBufferSource(ciphertext)
  );
  return new Uint8Array(plaintext);
}

/** Wrap an extractable DEK with a KEK (AES-GCM). */
export async function wrapDEK(
  kek: CryptoKey,
  dek: CryptoKey
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  const nonce = randomBytes(12);
  const wrapped = await crypto.subtle.wrapKey("raw", dek, kek, {
    name: "AES-GCM",
    iv: asBufferSource(nonce),
  });
  return { ciphertext: new Uint8Array(wrapped), nonce };
}

/**
 * Unwrap DEK as extractable so it can be persisted in the tab session,
 * then used for seal/open. Callers should clear session storage on logout.
 */
export async function unwrapDEK(
  kek: CryptoKey,
  wrapped: Uint8Array,
  nonce: Uint8Array
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    "raw",
    asBufferSource(wrapped),
    kek,
    { name: "AES-GCM", iv: asBufferSource(nonce) },
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function importDEK(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    asBufferSource(raw),
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportDEK(dek: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", dek));
}
