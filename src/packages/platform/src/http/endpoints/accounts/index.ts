import { ACCOUNT_TYPES, INSTRUMENT_ACCOUNT_TYPES } from "@core/domains/account/constants";
import { ACCOUNT_LIST_STATUSES } from "@core/domains/account/helpers";
import { CALENDAR_END_SOURCES } from "@core/shared/calendar";
import { detailsResponseSchema, paginatedListResponseSchema } from "@platform/http/envelopes";
import { requiredTrimmedString } from "@platform/schema/fields";
import { isoDateFieldSchema } from "@platform/schema/iso-date";
import { z } from "zod";

export const accountTypeSchema = z.enum(ACCOUNT_TYPES);
export const instrumentAccountTypeSchema = z.enum(INSTRUMENT_ACCOUNT_TYPES);

const accountIsoDateFieldSchema = isoDateFieldSchema("Date is invalid.");

const mailSchema = z
  .object({
    subjects: z.array(z.string()).optional(),
    bodyContains: z.array(z.string()).optional(),
    fromAddresses: z.array(z.string()).optional(),
  })
  .strict()
  .optional()
  .nullable();

const statementSchema = z
  .object({
    textContains: z.array(z.string()).optional(),
    textNotContains: z.array(z.string()).optional(),
  })
  .strict()
  .optional()
  .nullable();

export const createAccountReqSchema = z.object({
  bank: requiredTrimmedString("Bank is required."),
  variant: z.string().nullable().optional(),
  accountType: instrumentAccountTypeSchema,
  openingDate: accountIsoDateFieldSchema,
  closingDate: accountIsoDateFieldSchema.nullable().optional(),
  accountNumber: z.string().min(1, { message: "Account number is required." }),
  passwords: z.array(z.string()).default([]),
  mail: mailSchema,
  statement: statementSchema,
});

export const patchAccountReqSchema = z.object({
  bank: requiredTrimmedString("Bank is required.").optional(),
  variant: z.string().nullable().optional(),
  accountType: instrumentAccountTypeSchema.optional(),
  openingDate: accountIsoDateFieldSchema.optional(),
  closingDate: accountIsoDateFieldSchema.nullable().optional(),
  accountNumber: z.string().min(1).optional(),
  passwords: z.array(z.string()).optional(),
  mail: mailSchema,
  statement: statementSchema,
});

const accountListSortSchema = z.enum(["label", "accountType", "currentBalance"]);
const sortDirectionSchema = z.enum(["asc", "desc"]);

export const accountListQuerySchema = z.object({
  accountType: instrumentAccountTypeSchema.optional(),
  status: z.enum(ACCOUNT_LIST_STATUSES).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  sort: accountListSortSchema.optional(),
  direction: sortDirectionSchema.optional(),
});

export const accountIdParamsSchema = z.object({
  accountId: z.string().uuid(),
});

const accountMailRulesSchema = z
  .object({
    subjects: z.array(z.string()),
    bodyContains: z.array(z.string()),
    fromAddresses: z.array(z.string()),
  })
  .nullable();

const accountStatementRulesSchema = z
  .object({
    textContains: z.array(z.string()),
    textNotContains: z.array(z.string()),
  })
  .nullable();

export const accountDataSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  accountType: accountTypeSchema,
  bank: z.string(),
  variant: z.string().nullable(),
  openingDate: z.string(),
  closingDate: z.string().nullable(),
  accountNumber: z.string(),
  hasPasswords: z.boolean().optional(),
  hasMailSettings: z.boolean().optional(),
  hasStatementRules: z.boolean().optional(),
  passwords: z.array(z.string()).optional(),
  mail: accountMailRulesSchema.optional(),
  statement: accountStatementRulesSchema.optional(),
});

export const accountSchema = detailsResponseSchema(accountDataSchema);

export const accountListItemSchema = accountDataSchema.extend({
  currentBalance: z.number().int(),
});

export const accountListSchema = paginatedListResponseSchema(accountListItemSchema);

const bankVariantSchema = z.object({
  key: z.string(),
  bank: z.string(),
  variant: z.string().nullable(),
  accountType: accountTypeSchema,
});

export const bankListSchema = paginatedListResponseSchema(bankVariantSchema);

const calendarMonthCellSchema = z.object({
  month: z.number().int(),
  year: z.number().int(),
  monthKey: z.string(),
});

const yearSectionSchema = z.object({
  yearKey: z.string(),
  label: z.string(),
  months: z.array(calendarMonthCellSchema),
});

const coverageSegmentSchema = z.object({
  start: z.string(),
  end: z.string(),
  approximate: z.boolean().optional(),
});

const coverageGapSchema = z.object({
  start: z.string(),
  end: z.string(),
  balancesMatch: z.boolean().nullable(),
});

const statementCoverageSchema = z.object({
  start: z.string().nullable(),
  end: z.string().nullable(),
  segments: z.array(coverageSegmentSchema),
  gaps: z.array(coverageGapSchema),
  months: z.array(z.string()),
  periodCount: z.number().int().nonnegative(),
});

const statementEntrySchema = z.object({
  accountId: z.string().uuid(),
  kind: z.enum(["monthly", "annual"]),
  period: z.string(),
  statementDate: z.string(),
  formats: z.array(z.string()),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  transactionsSynced: z.boolean(),
  transactionsImportId: z.string().uuid().nullable(),
});

const balanceGapSchema = z.object({
  month: z.string(),
  status: z.string(),
});

const statementListSchema = z.object({
  available: z.boolean(),
  statementCount: z.number().int().nonnegative(),
  starting: z.string().nullable(),
  ending: z.string().nullable(),
  formats: z.array(z.string()),
  coverage: statementCoverageSchema,
  statements: z.array(statementEntrySchema),
  balanceGaps: z.array(balanceGapSchema),
});

export const accountDetailsDataSchema = z.object({
  account: accountDataSchema,
  calendarStart: z.string(),
  calendarEnd: z.string(),
  calendarEndSource: z.enum(CALENDAR_END_SOURCES),
  closingDateConfigured: z.boolean(),
  calendarYearSections: z.array(yearSectionSchema),
  statements: statementListSchema,
});

export const accountDetailsSchema = detailsResponseSchema(accountDetailsDataSchema);
