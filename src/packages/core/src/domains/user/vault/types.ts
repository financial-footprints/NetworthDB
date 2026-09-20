import type { VaultSlotType } from "@core/domains/user/vault/constants";

export type VaultSlotInput = {
  slotType: VaultSlotType;
  salt: string;
  wrapBlob: string;
  credentialId?: string;
  label?: string;
  password?: string;
};

export type VaultSlotUpdateInput = {
  password?: string;
  salt: string;
  wrapBlob: string;
};

export type VaultSlotPublic = {
  id: string;
  slotType: VaultSlotType;
  salt: string;
  wrapBlob: string;
  credentialId: string | null;
  label: string;
};

export type VaultPublicState = {
  vaultInitialized: boolean;
  vaultSlots: VaultSlotPublic[];
  displayName: string | null;
};
