export const VAULT_SLOT_TYPES = ["password", "recovery_phrase", "webauthn_prf"] as const;

export type VaultSlotType = (typeof VAULT_SLOT_TYPES)[number];

export const VAULT_SLOT_TYPE_PASSWORD: VaultSlotType = "password";
export const VAULT_SLOT_TYPE_RECOVERY_PHRASE: VaultSlotType = "recovery_phrase";
export const VAULT_SLOT_TYPE_WEBAUTHN_PRF: VaultSlotType = "webauthn_prf";

export const MAX_VAULT_NONCE_LEN = 64;
export const MAX_VAULT_WRAP_BLOB_LEN = 600;
export const MAX_VAULT_WRAP_CT_LEN = 512;
export const MAX_VAULT_SLOT_LABEL = 128;
export const MAX_RECOVERY_PHRASE_SLOTS = 10;

export function isVaultSlotType(slotType: string): slotType is VaultSlotType {
  return (VAULT_SLOT_TYPES as readonly string[]).includes(slotType);
}
