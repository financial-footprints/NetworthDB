import { ACCOUNT_TYPES, CALENDAR_END_SOURCES } from "@ndb/core";
import { requiredTrimmedString } from "@platform/fields";
import { dataEnvelopeSchema, paginatedDataEnvelopeSchema } from "@platform/http";
import { z } from "zod";

export const accountTypeSchema = z.enum(ACCOUNT_TYPES);

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "api.accounts.date.invalid.format" });

const mailRulesSchema = z
  .object({
    subjects: z.array(z.string()).optional(),
    body_contains: z.array(z.string()).optional(),
    from: z.array(z.string()).optional(),
  })
  .strict()
  .optional()
  .nullable();

const statementRulesSchema = z
  .object({
    text_contains: z.array(z.string()).optional(),
    text_not_contains: z.array(z.string()).optional(),
  })
  .strict()
  .optional()
  .nullable();

function mapMailRules(
  mailRules:
    | {
        subjects?: string[];
        body_contains?: string[];
        from?: string[];
      }
    | null
    | undefined
) {
  if (mailRules === undefined) {
    return undefined;
  }
  if (mailRules === null) {
    return null;
  }
  return {
    subjects: mailRules.subjects,
    bodyContains: mailRules.body_contains,
    fromAddresses: mailRules.from,
  };
}

function mapStatementRules(
  statementRules:
    | {
        text_contains?: string[];
        text_not_contains?: string[];
      }
    | null
    | undefined
) {
  if (statementRules === undefined) {
    return undefined;
  }
  if (statementRules === null) {
    return null;
  }
  return {
    textContains: statementRules.text_contains,
    textNotContains: statementRules.text_not_contains,
  };
}

export const createAccountReqSchema = z
  .object({
    bank: requiredTrimmedString("api.accounts.create.invalid.bank-required"),
    variant: z.string().nullable().optional(),
    account_type: accountTypeSchema,
    opening_date: isoDateSchema,
    closing_date: isoDateSchema.nullable().optional(),
    account_number: z
      .string()
      .min(1, { message: "api.accounts.create.invalid.account-number-required" }),
    passwords: z.array(z.string()).default([]),
    mail_rules: mailRulesSchema,
    statement_rules: statementRulesSchema,
  })
  .transform((body) => ({
    bank: body.bank,
    variant: body.variant,
    accountType: body.account_type,
    openingDate: body.opening_date,
    closingDate: body.closing_date,
    accountNumber: body.account_number,
    passwords: body.passwords,
    mail: mapMailRules(body.mail_rules),
    statement: mapStatementRules(body.statement_rules),
  }));

export const patchAccountReqSchema = z
  .object({
    bank: requiredTrimmedString("api.accounts.patch.invalid.bank-required").optional(),
    variant: z.string().nullable().optional(),
    account_type: accountTypeSchema.optional(),
    opening_date: isoDateSchema.optional(),
    closing_date: isoDateSchema.nullable().optional(),
    account_number: z.string().min(1).optional(),
    passwords: z.array(z.string()).optional(),
    mail_rules: mailRulesSchema,
    statement_rules: statementRulesSchema,
  })
  .transform((body) => ({
    bank: body.bank,
    variant: body.variant,
    accountType: body.account_type,
    openingDate: body.opening_date,
    closingDate: body.closing_date,
    accountNumber: body.account_number,
    passwords: body.passwords,
    mail: mapMailRules(body.mail_rules),
    statement: mapStatementRules(body.statement_rules),
  }));

export const accountListQuerySchema = z.object({
  account_type: accountTypeSchema.optional(),
});

export const accountIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const accountMailRulesSchema = z
  .object({
    subjects: z.array(z.string()),
    body_contains: z.array(z.string()),
    from: z.array(z.string()),
  })
  .nullable();

const accountStatementRulesSchema = z
  .object({
    text_contains: z.array(z.string()),
    text_not_contains: z.array(z.string()),
  })
  .nullable();

export const accountDataSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  account_type: accountTypeSchema,
  bank: z.string(),
  variant: z.string().nullable(),
  opening_date: z.string(),
  closing_date: z.string().nullable(),
  account_number: z.string(),
  has_passwords: z.boolean().optional(),
  has_mail_settings: z.boolean().optional(),
  has_statement_rules: z.boolean().optional(),
  passwords: z.array(z.string()).optional(),
  mail_rules: accountMailRulesSchema.optional(),
  statement_rules: accountStatementRulesSchema.optional(),
});

export const accountSchema = dataEnvelopeSchema(accountDataSchema);
export const accountListSchema = paginatedDataEnvelopeSchema(accountDataSchema);

const bankVariantSchema = z.object({
  key: z.string(),
  bank: z.string(),
  variant: z.string().nullable(),
  account_type: z.string(),
});

export const bankListSchema = dataEnvelopeSchema(
  z.object({
    items: z.array(bankVariantSchema),
    total: z.number().int().nonnegative(),
  })
);

const calendarMonthCellSchema = z.object({
  month: z.number().int(),
  year: z.number().int(),
  month_key: z.string(),
});

const yearSectionSchema = z.object({
  year_key: z.string(),
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
  balances_match: z.boolean().nullable(),
});

const statementCoverageSchema = z.object({
  start: z.string().nullable(),
  end: z.string().nullable(),
  segments: z.array(coverageSegmentSchema),
  gaps: z.array(coverageGapSchema),
  months: z.array(z.string()),
  period_count: z.number().int().nonnegative(),
});

const statementEntrySchema = z.object({
  account_id: z.string().uuid(),
  kind: z.enum(["monthly", "annual"]),
  period: z.string(),
  statement_date: z.string(),
  formats: z.array(z.string()),
  period_start: z.string().nullable(),
  period_end: z.string().nullable(),
});

const balanceGapSchema = z.object({
  month: z.string(),
  status: z.string(),
});

const statementListSchema = z.object({
  available: z.boolean(),
  statement_count: z.number().int().nonnegative(),
  starting: z.string().nullable(),
  ending: z.string().nullable(),
  formats: z.array(z.string()),
  coverage: statementCoverageSchema,
  statements: z.array(statementEntrySchema),
  balance_gaps: z.array(balanceGapSchema),
});

const accountDetailsDataSchema = z.object({
  account: accountDataSchema,
  calendar_start: z.string(),
  calendar_end: z.string(),
  calendar_end_source: z.enum(CALENDAR_END_SOURCES),
  closing_date_configured: z.boolean(),
  calendar_year_sections: z.array(yearSectionSchema),
  statements: statementListSchema,
});

export const accountDetailsSchema = dataEnvelopeSchema(accountDetailsDataSchema);
