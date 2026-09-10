export type { WebAuthnRpConfig } from "@core/domains/auth/modules/webauthn/embedded/webauthn";
export { WebAuthnCredential } from "@core/domains/auth/modules/webauthn/entities/webauthn-credential";
export { WebAuthnSession } from "@core/domains/auth/modules/webauthn/entities/webauthn-session";
export type {
  WebAuthnCredentialFilters,
  WebAuthnCredentialRepository,
  WebAuthnCredentialSortColumn,
  WebAuthnCredentialUpdate,
} from "@core/domains/auth/modules/webauthn/repositories/webauthn-credential-repository";
export type {
  WebAuthnSessionFilters,
  WebAuthnSessionRepository,
  WebAuthnSessionSortColumn,
} from "@core/domains/auth/modules/webauthn/repositories/webauthn-session-repository";
export {
  type WebAuthnBeginResponse,
  type WebAuthnCredentialSummary,
  WebAuthnService,
  type WebAuthnServiceConfig,
} from "@core/domains/auth/modules/webauthn/services/webauthn-service";
