import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import {
  decodeBase64url,
  encodeBase64url,
  randomBytes,
  unwrapDEK,
  wrapDEK,
} from "@web/utils/crypto/aes";
import { asBufferSource } from "@web/utils/crypto/helpers";
import { deriveKEK } from "@web/utils/crypto/kdf";
import { packE2EEBlob, unpackE2EEBlob } from "@web/utils/crypto/vault/blob";
import type { VaultSlotMaterial, VaultSlotType } from "@web/utils/crypto/vault/types";

const PRF_HKDF_INFO = new TextEncoder().encode("networth-vault-kek");

async function derivePRFKEK(prfOutput: Uint8Array, prfSalt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", asBufferSource(prfOutput), "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: asBufferSource(prfSalt),
      info: PRF_HKDF_INFO,
    },
    baseKey,
    256
  );
  return crypto.subtle.importKey("raw", bits, { name: "AES-GCM", length: 256 }, false, [
    "wrapKey",
    "unwrapKey",
  ]);
}

export async function wrapDEKForSlot(
  dek: CryptoKey,
  slotType: VaultSlotType,
  secret: string | Uint8Array,
  existingSalt?: Uint8Array
): Promise<{ salt: string; wrap_blob: string }> {
  const salt = existingSalt ?? randomBytes(16);
  let kek: CryptoKey;
  if (slotType === "webauthn_prf") {
    if (!(secret instanceof Uint8Array)) {
      throw new Error("PRF slot requires Uint8Array secret");
    }
    kek = await derivePRFKEK(secret, salt);
  } else {
    if (typeof secret !== "string") {
      throw new Error("password and recovery phrase slots require string secret");
    }
    kek = await deriveKEK(secret, salt);
  }
  const wrapped = await wrapDEK(kek, dek);
  return {
    salt: encodeBase64url(salt),
    wrap_blob: packE2EEBlob(encodeBase64url(wrapped.nonce), encodeBase64url(wrapped.ciphertext)),
  };
}

export async function unwrapDEKFromSlot(
  slot: VaultSlotMaterial,
  secret: string | Uint8Array
): Promise<CryptoKey> {
  const salt = decodeBase64url(slot.salt);
  let kek: CryptoKey;
  if (slot.slot_type === "webauthn_prf") {
    if (!(secret instanceof Uint8Array)) {
      throw new Error("PRF slot requires Uint8Array secret");
    }
    kek = await derivePRFKEK(secret, salt);
  } else {
    if (typeof secret !== "string") {
      throw new Error("password and recovery phrase slots require string secret");
    }
    kek = await deriveKEK(secret, salt);
  }
  const { nonce, ciphertext } = unpackE2EEBlob(slot.wrap_blob);
  return unwrapDEK(kek, decodeBase64url(ciphertext), decodeBase64url(nonce));
}

export function credentialIdsMatch(stored: string | null | undefined, asserted: string): boolean {
  if (!stored || !asserted) {
    return false;
  }
  if (stored === asserted) {
    return true;
  }
  try {
    return encodeBase64url(decodeBase64url(stored)) === encodeBase64url(decodeBase64url(asserted));
  } catch {
    return false;
  }
}

export function findPasswordSlot<T extends VaultSlotMaterial>(slots: T[]): T | undefined {
  return slots.find((slot) => slot.slot_type === "password");
}

export async function createPasswordSlot(
  dek: CryptoKey,
  password: string
): Promise<VaultSlotMaterial> {
  const wrapped = await wrapDEKForSlot(dek, "password", password);
  return {
    slot_type: "password",
    salt: wrapped.salt,
    wrap_blob: wrapped.wrap_blob,
  };
}

export async function createRecoveryPhraseSlot(
  dek: CryptoKey,
  phrase: string
): Promise<VaultSlotMaterial> {
  const wrapped = await wrapDEKForSlot(dek, "recovery_phrase", phrase);
  return {
    slot_type: "recovery_phrase",
    salt: wrapped.salt,
    wrap_blob: wrapped.wrap_blob,
  };
}

export function generateRecoveryPhrase(): string {
  return generateMnemonic(wordlist, 128);
}

export async function rewrapVault(
  dek: CryptoKey,
  newPassword: string
): Promise<{ salt: string; wrap_blob: string }> {
  return wrapDEKForSlot(dek, "password", newPassword);
}

export async function createVault(password: string): Promise<{
  dek: CryptoKey;
  slots: VaultSlotMaterial[];
}> {
  const dek = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const slots: VaultSlotMaterial[] = [await createPasswordSlot(dek, password)];
  return { dek, slots };
}
