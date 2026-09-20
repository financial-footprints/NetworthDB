import type { VaultSlot } from "@web/utils/api/routes/auth/types";

export type { VaultSlot };

export type VaultSlotMaterial = Pick<VaultSlot, "slotType" | "salt" | "wrapBlob">;
export type VaultSlotType = VaultSlot["slotType"];

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
