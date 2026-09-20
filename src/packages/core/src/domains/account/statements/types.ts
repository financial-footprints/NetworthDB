import type { StatementKind } from "@core/domains/account/statements/entities/statement-upload";

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

export type { StatementKind };

export type Statement = {
  accountId: string;
  kind: StatementKind;
  period: string;
  statementDate: string;
  formats: string[];
  periodStart: string | null;
  periodEnd: string | null;
  transactionsSynced: boolean;
  transactionsImportId: string | null;
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
