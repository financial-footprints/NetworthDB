import type { VaultSlotType } from "@core/domains/user/modules/vault/embedded/vault-wrap";

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
  e2eeVaultInitialized: boolean;
  e2eeSlots: VaultSlotPublic[];
  e2eeName: string | null;
};
