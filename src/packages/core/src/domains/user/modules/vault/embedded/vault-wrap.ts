import { ValidationError } from "@core/shared/errors/domain-error";

export const VAULT_SLOT_TYPE_PASSWORD = "password";
export const VAULT_SLOT_TYPE_RECOVERY_PHRASE = "recovery_phrase";
export const VAULT_SLOT_TYPE_WEBAUTHN_PRF = "webauthn_prf";

export const MAX_VAULT_SALT_LEN = 64;
export const MAX_VAULT_NONCE_LEN = 64;
export const MAX_VAULT_WRAP_BLOB_LEN = 600;
export const MAX_VAULT_WRAP_CT_LEN = 512;
export const MAX_VAULT_SLOT_LABEL = 128;
export const MAX_RECOVERY_PHRASE_SLOTS = 10;
export const MAX_E2EE_NAME_BLOB_LEN = 2100;
export const MAX_E2EE_NAME_CT_LEN = 2048;

export type VaultSlotType =
  | typeof VAULT_SLOT_TYPE_PASSWORD
  | typeof VAULT_SLOT_TYPE_RECOVERY_PHRASE
  | typeof VAULT_SLOT_TYPE_WEBAUTHN_PRF;

const BLOB_SEPARATOR = ".";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const binary = atob(`${padded}${"=".repeat(padLength)}`);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export function packBlob(nonce: string, ciphertext: string): string {
  return `${nonce}${BLOB_SEPARATOR}${ciphertext}`;
}

export function unpackBlob(blob: string): { nonce: string; ciphertext: string } {
  const trimmed = blob.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("core.auth.vault.blob.invalid.empty");
  }

  const dot = trimmed.indexOf(BLOB_SEPARATOR);
  if (dot <= 0 || dot === trimmed.length - 1) {
    throw new ValidationError("core.auth.vault.blob.invalid.format");
  }

  const nonce = trimmed.slice(0, dot);
  const ciphertext = trimmed.slice(dot + 1);
  if (nonce.length === 0 || ciphertext.length === 0) {
    throw new ValidationError("core.auth.vault.blob.invalid.format");
  }

  return { nonce, ciphertext };
}

export function isValidSlotType(slotType: string): slotType is VaultSlotType {
  return (
    slotType === VAULT_SLOT_TYPE_PASSWORD ||
    slotType === VAULT_SLOT_TYPE_RECOVERY_PHRASE ||
    slotType === VAULT_SLOT_TYPE_WEBAUTHN_PRF
  );
}

export function validateSlotSalt(salt: string): void {
  const trimmed = salt.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("core.auth.vault.slot.invalid.salt");
  }

  if (trimmed.length > MAX_VAULT_SALT_LEN) {
    throw new ValidationError("core.auth.vault.slot.invalid.salt");
  }
}

export function validateSlotWrapBlob(blob: string): void {
  const trimmed = blob.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_VAULT_WRAP_BLOB_LEN) {
    throw new ValidationError("core.auth.vault.slot.invalid.wrap");
  }

  const { nonce, ciphertext } = unpackBlob(trimmed);
  if (nonce.length > MAX_VAULT_NONCE_LEN || ciphertext.length > MAX_VAULT_WRAP_CT_LEN) {
    throw new ValidationError("core.auth.vault.slot.invalid.wrap");
  }
}

export function validateSlotLabel(label: string): void {
  if (label.length > MAX_VAULT_SLOT_LABEL) {
    throw new ValidationError("core.auth.vault.slot.invalid.label");
  }
}

export function validateE2eeNameBlob(blob: string): void {
  const trimmed = blob.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("core.auth.vault.e2ee-name.invalid.required");
  }

  if (trimmed.length > MAX_E2EE_NAME_BLOB_LEN) {
    throw new ValidationError("core.auth.vault.e2ee-name.invalid.too-long");
  }

  const { nonce, ciphertext } = unpackBlob(trimmed);
  if (nonce.length > MAX_VAULT_NONCE_LEN) {
    throw new ValidationError("core.auth.vault.e2ee-name.invalid.nonce-too-long");
  }

  if (ciphertext.length > MAX_E2EE_NAME_CT_LEN) {
    throw new ValidationError("core.auth.vault.e2ee-name.invalid.ciphertext-too-long");
  }
}

export function encodeCredentialId(raw: Uint8Array): string {
  if (raw.length === 0) {
    return "";
  }

  return toBase64Url(raw);
}

export function decodeCredentialId(encoded: string): Uint8Array {
  const trimmed = encoded.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("core.auth.vault.credential.invalid.id");
  }

  try {
    const raw = fromBase64Url(trimmed);
    if (raw.length === 0) {
      throw new ValidationError("core.auth.vault.credential.invalid.id");
    }

    return raw;
  } catch {
    throw new ValidationError("core.auth.vault.credential.invalid.id");
  }
}
