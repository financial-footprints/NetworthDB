export type StatementMetadata = {
  statement_date: string;
  formats: string[];
  opening_balance: string | null;
  closing_balance: string | null;
  period_start: string | null;
  period_end: string | null;
  period_approximate: boolean;
  granularity: string;
  covered_months: string[];
  year_key: string | null;
  transactions_synced?: boolean;
  transactions_import_id?: string | null;
};

export type CoverageSegment = {
  start: string;
  end: string;
  approximate: boolean;
};

export type CoverageGap = {
  start: string;
  end: string;
  balances_match: boolean | null;
};

export type PeriodCovered = {
  start: string | null;
  end: string | null;
  segments: CoverageSegment[];
  gaps: CoverageGap[];
  months: string[];
  period_count: number;
};

export type StoredAccountMetadata = {
  account_id: string;
  bank: string;
  variant: string | null;
  account_type: string;
  opening_date: string | null;
  closing_date: string | null;
  formats: string[];
  statements: StatementMetadata[];
  statement_dates: string[];
  starting: string | null;
  ending: string | null;
  statement_count: number;
  period_covered: PeriodCovered;
  last_fetch_date?: string | null;
};
