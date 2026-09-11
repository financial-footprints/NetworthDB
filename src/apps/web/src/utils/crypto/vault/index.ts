export {
  hasE2EEVault,
  openField,
  sealField,
} from "@web/utils/crypto/vault/fields";
export { ensureVaultAtLogin } from "@web/utils/crypto/vault/init";
export {
  createPasswordSlot,
  createRecoveryPhraseSlot,
  createVault,
  credentialIdsMatch,
  findPasswordSlot,
  generateRecoveryPhrase,
  rewrapVault,
  wrapDEKForSlot,
} from "@web/utils/crypto/vault/slots";
export type {
  AutoUnlockResult,
  UnlockContext,
  UnlockMethod,
  WebAuthnUnlockContext,
} from "@web/utils/crypto/vault/types";
export {
  listUnlockMethods,
  tryAutoUnlock,
  unlockVault,
  unlockVaultManual,
} from "@web/utils/crypto/vault/unlock";
export {
  authenticateVaultPrf,
  buildPrfAuthenticationExtensions,
  extractWebAuthnUnlockContext,
  registerVaultPrf,
} from "@web/utils/crypto/vault/webauth";
