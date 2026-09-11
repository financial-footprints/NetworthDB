export {
  APP_ENVS,
  type AppEnv,
  RECOVERY_KIND_ADVANCED,
  RECOVERY_KIND_PASSWORD_RESET,
} from "@core/domains/auth/constants";
export { MultifactorChallenge } from "@core/domains/auth/entities/multifactor-challenge";
export { RecoveryChallenge } from "@core/domains/auth/entities/recovery-challenge";
export { RecoveryCode } from "@core/domains/auth/entities/recovery-code";
export { RecoveryEmail } from "@core/domains/auth/entities/recovery-email";
export { Session } from "@core/domains/auth/entities/session";
export { WebAuthnCredential } from "@core/domains/auth/entities/webauthn-credential";
export { WebAuthnSession } from "@core/domains/auth/entities/webauthn-session";
export type {
  MultifactorChallengeResponse,
  SessionTokenPair,
} from "@core/domains/auth/helpers";
export { isSessionTokenPair } from "@core/domains/auth/helpers";
export type {
  MultifactorChallengeFilters,
  MultifactorChallengeRepository,
  MultifactorChallengeSortColumn,
  MultifactorChallengeUpdate,
} from "@core/domains/auth/repositories/multifactor-challenge-repository";
export type {
  RecoveryChallengeFilters,
  RecoveryChallengeRepository,
  RecoveryChallengeSortColumn,
  RecoveryChallengeUpdate,
} from "@core/domains/auth/repositories/recovery-challenge-repository";
export type {
  RecoveryCodeFilters,
  RecoveryCodeRepository,
  RecoveryCodeSortColumn,
  RecoveryCodeUpdate,
} from "@core/domains/auth/repositories/recovery-code-repository";
export type {
  SessionFilters,
  SessionRepository,
  SessionSortColumn,
} from "@core/domains/auth/repositories/session-repository";
export type {
  WebAuthnCredentialFilters,
  WebAuthnCredentialRepository,
  WebAuthnCredentialSortColumn,
  WebAuthnCredentialUpdate,
} from "@core/domains/auth/repositories/webauthn-credential-repository";
export type {
  WebAuthnSessionFilters,
  WebAuthnSessionRepository,
  WebAuthnSessionSortColumn,
} from "@core/domains/auth/repositories/webauthn-session-repository";
export type {
  AuthServiceConfig,
  AuthServiceDeps,
  RegisterUserInput,
} from "@core/domains/auth/services/auth-service";
export { AuthService } from "@core/domains/auth/services/auth-service";
export type {
  MultifactorServiceConfig,
  ResolvedMultifactorBearer,
} from "@core/domains/auth/services/multifactor-service";
export { MultifactorService } from "@core/domains/auth/services/multifactor-service";
export type {
  AdvancedRecoveryContext,
  RecoveryServiceConfig,
} from "@core/domains/auth/services/recovery-service";
export { RECOVERY_GENERIC_OK, RecoveryService } from "@core/domains/auth/services/recovery-service";
export { SessionLifecycle } from "@core/domains/auth/services/session-lifecycle";
export type {
  WebAuthnBeginResponse,
  WebAuthnCredentialSummary,
  WebAuthnServiceConfig,
} from "@core/domains/auth/services/webauthn-service";
export { WebAuthnService } from "@core/domains/auth/services/webauthn-service";
