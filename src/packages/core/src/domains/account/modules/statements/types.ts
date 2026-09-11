export type CoverageSegment = {
  start: string;
  end: string;
  approximate?: boolean;
};

export type CoverageGap = {
  start: string;
  end: string;
  balancesMatch?: boolean;
};

export type StatementCoverage = {
  start?: string;
  end?: string;
  segments: CoverageSegment[];
  gaps: CoverageGap[];
  months: string[];
  periodCount: number;
};

export type BalanceGap = {
  month: string;
  status: string;
};

export type StatementKind = "monthly" | "annual";

export type Statement = {
  accountId: string;
  kind: StatementKind;
  period: string;
  statementDate: string;
  formats: string[];
  periodStart: string | null;
  periodEnd: string | null;
};

export type StatementList = {
  available: boolean;
  statementCount: number;
  starting?: string;
  ending?: string;
  formats: string[];
  coverage: StatementCoverage;
  statements: Statement[];
  balanceGaps: BalanceGap[];
};

export type StatementWarning = {
  kind: string;
  message: string;
  account: string;
  sourceFile: string;
  textContains: string[];
};

export type StatementPipelineResult = {
  ok: boolean;
  reason?: string;
  warnings: StatementWarning[];
  logs?: string;
};

export type Bank = {
  key: string;
  bank: string;
  variant: string | null;
  accountType: string;
};

export type TransactionRow = {
  date: string;
  description: string;
  refNo: string;
  credited: string;
  debited: string;
  sourceFile: string;
};

export type StatementTransactions = {
  period: string;
  isAnnual: boolean;
  rows: TransactionRow[];
};
