import {
  ACCOUNT_TYPE_LABELS,
  type bankListSchema,
  type AccountApi as PlatformAccountApi,
  type AccountDetailsApi as PlatformAccountDetailsApi,
  type AccountType as PlatformAccountType,
} from "@ndb/platform";
import type { SortDirection } from "@web/utils/list";
import type { z } from "zod";

export type AccountType = PlatformAccountType;

export { ACCOUNT_TYPE_LABELS };

export const INSTRUMENT_ACCOUNT_TYPE_OPTIONS = [
  "bank",
  "credit_card",
  "loan",
  "stocks",
  "bonds",
  "mutual_funds",
] as const satisfies readonly AccountType[];

export { isSystemAccountType, supportsStatements } from "@ndb/platform";

/** Raw account from API (accountNumber is opaque E2E blob until decrypted). */
export type AccountApi = PlatformAccountApi;

/** Client account with decrypted account number for tiles and forms. */
export type Account = PlatformAccountApi & {
  currentBalance: number;
};

export type AccountListSort = "label" | "accountType" | "currentBalance";

export type AccountListQuery = {
  account_type?: AccountType;
  status?: "open" | "closed" | "all";
  q?: string;
  sort?: AccountListSort;
  direction?: SortDirection;
};

export type AccountListResponse = {
  accounts: Account[];
};

export type AccountWritePayload = {
  bank: string;
  variant?: string | null;
  account_number: string;
  passwords: string[];
  opening_date: string;
  closing_date?: string | null;
  statement?: {
    text_contains?: string[];
    text_not_contains?: string[];
  };
  mail?: {
    subjects?: string[];
    body_contains?: string[];
    from?: string[];
  };
  type: AccountType;
};

export type AccountUpdatePayload = Omit<AccountWritePayload, "passwords"> & {
  passwords?: string[];
};

export type BankListResponse = z.infer<typeof bankListSchema>;

export type BankVariant = BankListResponse["items"][number];

export type CalendarEndSource = PlatformAccountDetailsApi["calendarEndSource"];

export type StatementFormat = "pdf" | "txt" | "csv" | "transactions";

export type CoverageSegment =
  PlatformAccountDetailsApi["statements"]["coverage"]["segments"][number];

export type CoverageGap = PlatformAccountDetailsApi["statements"]["coverage"]["gaps"][number];

export type StatementCoverage = PlatformAccountDetailsApi["statements"]["coverage"];

export type MonthAvailability = {
  month: string;
  statement_date: string;
  formats: string[];
};

export type BalanceGapStatus =
  PlatformAccountDetailsApi["statements"]["balanceGaps"][number]["status"];

export type AnnualStatementAvailability = {
  year_key: string;
  statement_date: string;
  label: string;
  period_start: string;
  period_end: string;
  formats: string[];
};

export type StatementList = PlatformAccountDetailsApi["statements"];

export type CalendarYearSection = PlatformAccountDetailsApi["calendarYearSections"][number];

export type AccountDetails = Omit<PlatformAccountDetailsApi, "account"> & {
  account: Account;
};

export type AccountDetailsApi = Omit<PlatformAccountDetailsApi, "account"> & {
  account: AccountApi;
};

export type AccountDetailsParams = {
  accountId: string;
};

export type AccountFileParams = {
  accountId: string;
  statementDate: string;
  format: StatementFormat;
};

export type StatementUploadParams = {
  accountId: string;
  format: StatementFormat | "zip";
  file: File;
  statementKind?: string;
  coveredMonth?: string;
  yearKey?: string;
};

export function monthlyAvailabilityFromStatements(
  statements: StatementList
): Map<string, MonthAvailability> {
  return new Map(
    statements.statements
      .filter((entry) => entry.kind === "monthly")
      .map((entry) => [
        entry.period,
        {
          month: entry.period,
          statement_date: entry.statementDate,
          formats: entry.formats,
        },
      ])
  );
}

export function annualAvailabilityFromStatements(
  statements: StatementList
): Map<string, AnnualStatementAvailability> {
  return new Map(
    statements.statements
      .filter((entry) => entry.kind === "annual")
      .map((entry) => [
        entry.period,
        {
          year_key: entry.period,
          statement_date: entry.statementDate,
          label: `${entry.period} Annual`,
          period_start: entry.periodStart ?? entry.statementDate,
          period_end: entry.periodEnd ?? entry.statementDate,
          formats: entry.formats,
        },
      ])
  );
}
