import type { ListData } from "@web/utils/api/types";

export type AccountType = "credit_card" | "bank_account";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  credit_card: "Credit Card",
  bank_account: "Bank Account",
};

/** Raw account from API (account_number is opaque E2E blob). */
export type AccountApi = {
  id: string;
  label: string;
  bank: string;
  variant: string | null;
  account_type: AccountType;
  opening_date: string;
  closing_date: string | null;
  account_number: string;
  has_passwords?: boolean;
  has_mail_settings?: boolean;
  has_statement_rules?: boolean;
  passwords?: string[];
  mail_rules?: AccountWritePayload["mail"];
  statement_rules?: AccountWritePayload["statement"];
};

/** Client account with decrypted account number for tiles and forms. */
export type Account = Omit<AccountApi, "account_number"> & {
  account_number: string;
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
  type?: AccountType;
};

export type AccountUpdatePayload = Omit<AccountWritePayload, "passwords"> & {
  passwords?: string[];
};

export type BankVariant = {
  key: string;
  bank: string;
  variant: string | null;
  account_type: AccountType;
};

export type BankListResponse = ListData<BankVariant>;

export type CalendarEndSource = "configured" | "today";

export type StatementFormat = "pdf" | "txt" | "csv";

export type CoverageSegment = {
  start: string;
  end: string;
  approximate?: boolean;
};

export type CoverageGap = {
  start: string;
  end: string;
  balances_match?: boolean | null;
};

export type StatementCoverage = {
  start?: string | null;
  end?: string | null;
  segments?: CoverageSegment[];
  gaps?: CoverageGap[];
  months?: string[];
  period_count?: number;
};

export type MonthAvailability = {
  month: string;
  statement_date: string;
  formats: string[];
};

export type BalanceGapStatus = "matched" | "mismatched" | "discontinuity";

export type BalanceGap = {
  month: string;
  status: BalanceGapStatus;
};

export type AnnualStatementAvailability = {
  year_key: string;
  statement_date: string;
  label: string;
  period_start: string;
  period_end: string;
  formats: string[];
};

export type StatementEntry = {
  account_id: string;
  kind: "monthly" | "annual";
  period: string;
  statement_date: string;
  formats: string[];
  period_start: string | null;
  period_end: string | null;
};

export type StatementList = {
  available: boolean;
  statement_count: number;
  starting?: string | null;
  ending?: string | null;
  formats: string[];
  coverage: StatementCoverage;
  statements: StatementEntry[];
  balance_gaps: BalanceGap[];
};

export type CalendarMonthCell = {
  month: number;
  year: number;
  month_key: string;
};

export type CalendarYearSection = {
  year_key: string;
  label: string;
  months: CalendarMonthCell[];
};

export type AccountDetails = {
  account: Account;
  calendar_start?: string | null;
  calendar_end?: string | null;
  calendar_end_source: CalendarEndSource | null;
  closing_date_configured: boolean;
  calendar_year_sections: CalendarYearSection[];
  statements: StatementList;
};

export type AccountDetailsApi = Omit<AccountDetails, "account"> & {
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
          statement_date: entry.statement_date,
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
          statement_date: entry.statement_date,
          label: `${entry.period} Annual`,
          period_start: entry.period_start ?? entry.statement_date,
          period_end: entry.period_end ?? entry.statement_date,
          formats: entry.formats,
        },
      ])
  );
}
