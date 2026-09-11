import type { VaultSlot } from "@web/utils/api/endpoints/auth/types";

export type { VaultSlot };
export type VaultSlotMaterial = Pick<VaultSlot, "slot_type" | "salt" | "wrap_blob">;
export type VaultSlotType = VaultSlot["slot_type"];

export type UnlockMethod = "password" | "recovery_phrase" | "webauthn";

export type UnlockContext = {
  password?: string;
  webauthn?: { credentialId: string; prfOutput: Uint8Array };
  recoveryPhrase?: string;
};

export type AutoUnlockResult =
  | { kind: "no_vault" }
  | { kind: "unlocked"; dek: CryptoKey }
  | { kind: "manual_required"; methods: UnlockMethod[] };

export type WebAuthnUnlockContext = {
  credentialId: string;
  prfOutput: Uint8Array;
};
