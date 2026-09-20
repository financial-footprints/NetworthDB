import type { WebAuthnCredential } from "@web/utils/api/routes/auth/mfa";
import type { VaultSlot } from "@web/utils/api/routes/auth/types";
import { credentialIdsMatch } from "@web/utils/crypto/vault";

export function recoveryPhraseLabel(slot: VaultSlot, index: number): string {
  return slot.label?.trim() || `Recovery phrase ${index + 1}`;
}

export function resolvePasskeyName(slot: VaultSlot, passkeys: WebAuthnCredential[]): string {
  if (slot.label?.trim()) {
    return slot.label.trim();
  }
  const match = passkeys.find((passkey) => credentialIdsMatch(slot.credentialId, passkey.id));
  return match?.name || "Passkey";
}

export function slotTitle(
  slot: VaultSlot,
  passkeys: WebAuthnCredential[],
  recoveryIndex: number
): string {
  if (slot.slotType === "password") {
    return "Login Password";
  }
  if (slot.slotType === "recovery_phrase") {
    return recoveryPhraseLabel(slot, recoveryIndex);
  }
  return resolvePasskeyName(slot, passkeys);
}

export function slotSubtitle(slot: VaultSlot): string {
  if (slot.slotType === "password") {
    return "Uses your sign-in password";
  }
  if (slot.slotType === "recovery_phrase") {
    return "Offline backup phrase";
  }
  return "Passkey decryption key";
}
