// Paths

export { API, API_PREFIX, apiPath, PUBLIC_API_PATHS } from "@platform/http/endpoints";

// Client-safe domain helpers (re-exported from @core leaf modules)

export {
  isSystemAccountType,
  supportsStatements,
} from "@core/domains/account/constants";
export {
  RULE_ACTION_TYPES,
  RULE_TRIGGER_TYPES,
} from "@core/domains/account/rules/constants";
export { parseRupeeToInteger } from "@core/shared/money";
export {
  ACCOUNT_TYPE_LABELS,
  type AccountPickerLabelInput,
  accountRegistryKey,
  formatInstrumentAccountPickerLabel,
  resolveCreditCardCatalogTitle,
} from "@platform/accounts/display-label";

// Endpoint request/response schemas

export {
  ACCOUNTS_JSON_NAME,
  backupAccountsFileSchema,
} from "@platform/http/endpoints/accounts/backup";
export { accountFileDownloadQuerySchema } from "@platform/http/endpoints/accounts/files";
export {
  accountDetailsSchema,
  accountIdParamsSchema,
  accountListQuerySchema,
  accountListSchema,
  accountSchema,
  bankListSchema,
  createAccountReqSchema,
  patchAccountReqSchema,
} from "@platform/http/endpoints/accounts/index";
export { statementSyncReqSchema } from "@platform/http/endpoints/accounts/statements";
export {
  balanceSchema,
  batchTransactionsReqSchema,
  bulkDeleteTransactionsReqSchema,
  bulkDeleteTransactionsSchema,
  bulkUpdateTransactionsReqSchema,
  bulkUpdateTransactionsSchema,
  createTransactionReqSchema,
  importIdParamsSchema,
  patchTransactionReqSchema,
  rangeSummarySchema,
  systemAccountsSchema,
  transactionBalanceQuerySchema,
  transactionIdParamsSchema,
  transactionImportSchema,
  transactionListQuerySchema,
  transactionListSchema,
  transactionSchema,
  transactionSummaryQuerySchema,
  transactionsSyncReqSchema,
} from "@platform/http/endpoints/accounts/transactions";
export {
  meDetailsSchema,
  messageSchema,
  patchAdminUserReqSchema,
  patchMeReqSchema,
  patchMeSchema,
  registerUserReqSchema,
  userListSchema,
  userSchema,
} from "@platform/http/endpoints/auth/account";
export {
  type AdminUserListQuery,
  adminUserListQuerySchema,
  userIdParamsSchema,
} from "@platform/http/endpoints/auth/admin";
export {
  credentialIdParamsSchema,
  mfaProofReqSchema,
  mfaVerifyReqSchema,
  recoveryCodeSchema,
  totpBeginSchema,
  totpConfirmReqSchema,
  totpDisableReqSchema,
  webauthnCredSchema,
  webauthnFinishReqSchema,
  webauthnSessionSchema,
} from "@platform/http/endpoints/auth/multifactor";
export {
  advCompleteReqSchema,
  advCompleteSchema,
  advCtxSchema,
  pwResetBeginReqSchema,
  pwResetCompleteReqSchema,
  recoveryTokenReqSchema,
} from "@platform/http/endpoints/auth/recovery";
export {
  loginReqSchema,
  loginSchema,
  mfaChallengeSchema,
  nullableSessionResponseSchema,
  refreshReqSchema,
  sessionTokenSchema,
} from "@platform/http/endpoints/auth/session";
export {
  slotIdParamsSchema,
  vaultAddSlotReqSchema,
  vaultInitReqSchema,
  vaultPasswordReqSchema,
  vaultSlotInputSchema,
  vaultSlotSchema,
  vaultSlotsSchema,
  vaultSlotUpdateReqSchema,
} from "@platform/http/endpoints/auth/vault";
export { backupExportBodySchema, backupExportStatusSchema } from "@platform/http/endpoints/backup";
export {
  categoryIdParamsSchema,
  categoryListQuerySchema,
  categoryListSchema,
  categorySchema,
  createCategoryReqSchema,
  patchCategoryReqSchema,
} from "@platform/http/endpoints/categories";
export { configSchema } from "@platform/http/endpoints/config";
export {
  type CreditCardBenefitView,
  type CreditCardCatalogListItem,
  catalogBenefitSlotIds,
  creditCardBenefitSchema,
  creditCardBenefitSlotParamsSchema,
  creditCardCatalogBulkSchema,
  creditCardCatalogDetailsSchema,
  creditCardCatalogListQuerySchema,
  creditCardCatalogListSchema,
  creditCardCatalogParamsSchema,
} from "@platform/http/endpoints/credit-cards";
export { dashboardQuerySchema, dashboardSnapshotSchema } from "@platform/http/endpoints/dashboard";
export { healthResponseSchema } from "@platform/http/endpoints/health";
export {
  jobCreatedSchema,
  jobIdParamsSchema,
  jobListSchema,
  jobSchema,
  jobsCancelQuerySchema,
  jobsCancelSchema,
} from "@platform/http/endpoints/jobs";
export {
  createRuleGroupReqSchema,
  patchRuleGroupReqSchema,
  ruleGroupIdParamsSchema,
  ruleGroupListQuerySchema,
  ruleGroupListSchema,
  ruleGroupSchema,
} from "@platform/http/endpoints/rule-groups";
export {
  catalogItemSchema,
  createRuleReqSchema,
  patchRuleReqSchema,
  ruleExpressionSchema,
  ruleIdParamsSchema,
  ruleListQuerySchema,
  ruleListSchema,
  ruleSchema,
} from "@platform/http/endpoints/rules";
export { applyRulesReqSchema } from "@platform/http/endpoints/rules-apply";
export {
  testRuleDataSchema,
  testRuleReqSchema,
  testRuleSchema,
} from "@platform/http/endpoints/rules-test";
export { putSourcesReqSchema, sourcesSchema } from "@platform/http/endpoints/sources";
export {
  createTagReqSchema,
  patchTagReqSchema,
  tagIdParamsSchema,
  tagListQuerySchema,
  tagListSchema,
  tagSchema,
} from "@platform/http/endpoints/tags";

// Auth login parser

export {
  type LoginResult,
  parseLoginResponse,
  type TokenPair,
} from "@platform/http/endpoints/auth/parse-login";

// HTTP wire envelopes

export {
  detailsResponseSchema,
  nullableDetailsResponseSchema,
  pageLimitSchema,
  paginatedListResponseSchema,
} from "@platform/http/envelopes";
export {
  type ApiErrorResponse,
  apiErrorResponseSchema,
  NOT_FOUND_RESPONSE,
  REQUEST_ID_HEADER,
} from "@platform/http/error";

// ISO calendar strings (wire / Zod)

export {
  type OptionalIsoDateRange,
  optionalIsoDateRangeQuerySchema,
} from "@platform/schema/date-range-query";
export {
  addIsoCalendarDays,
  compareIsoDateStrings,
  formatIsoDateString,
  ISO_DATE_PATTERN,
  isoDateFieldSchema,
  parseIsoDateToLocalDate,
  validateIsoDateString,
} from "@platform/schema/iso-date";

// Logging redaction

export { omitSensitiveFields, redactObject } from "@platform/logging/redact";

// Card benefit catalogs (client-safe: schema, flatten, groups)

export {
  CATALOG_GROUPS,
  type CardCatalog,
  type CatalogGroup,
  type CatalogGroupId,
  type CatalogSlot,
  type CatalogSource,
  cardCatalogSchema,
  catalogSlotSchema,
  DEFAULT_KINDS,
  type DefaultKind,
  diffCatalogCoverage,
  type FlattenedCatalogSlot,
  flattenCatalogSlots,
  parseCardCatalog,
  REWARD_KINDS,
  type RewardKind,
  SLOT_CONDITION_TYPES,
  SLOT_CONFIDENCES,
  SLOT_STATUSES,
  type SlotConditionType,
  type SlotConfidence,
  type SlotStatus,
} from "@platform/cards/index";

// Inferred API types

export type {
  AccountApi,
  AccountDetailsApi,
  AccountType,
  AdvancedRecoveryContextApi,
  JobApi,
  MeDetailsApi,
  SessionTokenApi,
  SourcesApi,
} from "@platform/http/endpoints/types";
