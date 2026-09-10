// Paths

// Auth — account
export {
  meDetailsSchema,
  messageSchema,
  patchAdminUserReqSchema,
  patchMeReqSchema,
  patchMeSchema,
  publicUserListSchema,
  publicUserSchema,
  registerUserReqSchema,
} from "@platform/auth/account";
// Auth — admin
export {
  type AdminUserListQuery,
  adminUserIdParamsSchema,
  adminUserListQuerySchema,
} from "@platform/auth/admin";
// Auth — multifactor
export {
  mfaProofReqSchema,
  mfaVerifyReqSchema,
  recoveryCodeSchema,
  totpBeginSchema,
  totpConfirmReqSchema,
  totpDisableReqSchema,
  webauthnCredSchema,
  webauthnFinishReqSchema,
  webauthnSessionSchema,
} from "@platform/auth/multifactor";
// Auth — recovery
export {
  advCompleteReqSchema,
  advCompleteSchema,
  advCtxSchema,
  pwResetBeginReqSchema,
  pwResetCompleteReqSchema,
  recoveryTokenReqSchema,
} from "@platform/auth/recovery";
// Auth — session
export {
  emptySchema,
  loginReqSchema,
  loginSchema,
  mfaChallengeSchema,
  refreshReqSchema,
  sessionTokenSchema,
} from "@platform/auth/session";
// Auth — vault
export {
  vaultAddSlotReqSchema,
  vaultInitReqSchema,
  vaultPasswordReqSchema,
  vaultSlotSchema,
  vaultSlotsSchema,
  vaultSlotUpdateReqSchema,
} from "@platform/auth/vault";
export { API, API_PREFIX } from "@platform/endpoints";
// Health
export { healthResponseSchema } from "@platform/health";
// HTTP errors
export {
  type ApiErrorResponse,
  apiErrorResponseSchema,
  REQUEST_ID_HEADER,
} from "@platform/http";
