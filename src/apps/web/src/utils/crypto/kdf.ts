import { asBufferSource } from "@web/utils/crypto/aes";
import { argon2id } from "hash-wasm";

/** KiB; aligned with NetworthDB login Argon2id memory. */
const ARGON2_MEMORY_KIB = 65_536;
/** Time cost; aligned with NetworthDB login Argon2id. */
const ARGON2_ITERATIONS = 2;
/** Single lane — better for browser main-thread unlock. */
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_LENGTH = 32;

/**
 * Derive a vault Key Encryption Key from the login password and per-user salt.
 * Uses Argon2id (hash-wasm) so a leaked wrap blob resists GPU offline guessing.
 */
export async function deriveKEK(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const raw = await argon2id({
    password,
    salt,
    parallelism: ARGON2_PARALLELISM,
    iterations: ARGON2_ITERATIONS,
    memorySize: ARGON2_MEMORY_KIB,
    hashLength: ARGON2_HASH_LENGTH,
    outputType: "binary",
  });

  return crypto.subtle.importKey(
    "raw",
    asBufferSource(raw),
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"]
  );
}
