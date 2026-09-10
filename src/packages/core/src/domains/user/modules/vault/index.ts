export type { VaultSlotType } from "@core/domains/user/modules/vault/embedded/vault-wrap";
export {
  decodeCredentialId,
  encodeCredentialId,
  isValidSlotType,
  packBlob,
  unpackBlob,
  VAULT_SLOT_TYPE_PASSWORD,
  VAULT_SLOT_TYPE_RECOVERY_PHRASE,
  VAULT_SLOT_TYPE_WEBAUTHN_PRF,
  validateE2eeNameBlob,
} from "@core/domains/user/modules/vault/embedded/vault-wrap";
export { VaultSlot } from "@core/domains/user/modules/vault/entities/vault-slot";
export type {
  VaultSlotFilters,
  VaultSlotRepository,
  VaultSlotSortColumn,
  VaultSlotUpdate,
} from "@core/domains/user/modules/vault/repositories/vault-slot-repository";
export { VaultService } from "@core/domains/user/modules/vault/services/vault-service";
export type {
  VaultPublicState,
  VaultSlotInput,
  VaultSlotPublic,
  VaultSlotUpdateInput,
} from "@core/domains/user/modules/vault/types";
