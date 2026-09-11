// Paths

export { API, API_PREFIX } from "@platform/endpoints";
export {
  ACCOUNTS_JSON_NAME,
  backupAccountsFileSchema,
  backupSourcesFileSchema,
  SOURCES_JSON_NAME,
} from "@platform/endpoints/accounts/backup";
export {
  accountFileDownloadParamsSchema,
  accountFileDownloadQuerySchema,
} from "@platform/endpoints/accounts/files";
export {
  accountDetailsSchema,
  accountIdParamsSchema,
  accountListQuerySchema,
  accountListSchema,
  accountSchema,
  bankListSchema,
  createAccountReqSchema,
  patchAccountReqSchema,
} from "@platform/endpoints/accounts/index";
export {
  statementSyncCreatedSchema,
  statementSyncReqSchema,
} from "@platform/endpoints/accounts/statements";
export {
  meDetailsSchema,
  messageSchema,
  patchAdminUserReqSchema,
  patchMeReqSchema,
  patchMeSchema,
  registerUserReqSchema,
  userListSchema,
  userSchema,
} from "@platform/endpoints/auth/account";
export {
  type AdminUserListQuery,
  adminUserListQuerySchema,
  uuidIdParamsSchema,
} from "@platform/endpoints/auth/admin";
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
} from "@platform/endpoints/auth/multifactor";
export {
  advCompleteReqSchema,
  advCompleteSchema,
  advCtxSchema,
  pwResetBeginReqSchema,
  pwResetCompleteReqSchema,
  recoveryTokenReqSchema,
} from "@platform/endpoints/auth/recovery";
export {
  emptySchema,
  loginReqSchema,
  loginSchema,
  mfaChallengeSchema,
  refreshReqSchema,
  sessionTokenSchema,
} from "@platform/endpoints/auth/session";
export {
  vaultAddSlotReqSchema,
  vaultInitReqSchema,
  vaultPasswordReqSchema,
  vaultSlotSchema,
  vaultSlotsSchema,
  vaultSlotUpdateReqSchema,
} from "@platform/endpoints/auth/vault";
export { configSchema } from "@platform/endpoints/config";
export { healthResponseSchema } from "@platform/endpoints/health";
export {
  jobCreatedSchema,
  jobIdParamsSchema,
  jobListSchema,
  jobSchema,
  jobsCancelQuerySchema,
  jobsCancelSchema,
} from "@platform/endpoints/jobs";
export {
  putSourcesReqSchema,
  sourceSchema,
  sourcesSchema,
} from "@platform/endpoints/sources";
export {
  type ApiErrorResponse,
  apiErrorResponseSchema,
  REQUEST_ID_HEADER,
} from "@platform/http";
