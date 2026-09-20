import type { StatementWarning } from "@ndb/core";
import type { PeriodSource } from "@statements/banks/shared/period-source";

export type PreparedStatement = {
  period: string;
  cleanedText: string;
  pdfBytes: Buffer | null;
  sourceCsv: Buffer | null;
};

export type MonthGroups = {
  groups: Map<string, string[]>;
  rawByPath: Map<string, string>;
  pathMonth: Map<string, string>;
  pathHash: Map<string, string>;
  pathPeriodSource: Map<string, PeriodSource>;
};

export type CleanupAccountResult = {
  bank: string;
  downloadDir: string;
  unsupportedStagingRemoved: number;
  decrypted: number;
  prepared: number;
  rejected: number;
  orphansRemoved: number;
  skipped: boolean;
  warnings: StatementWarning[];
  preparedStatements: PreparedStatement[];
};

export type MetadataAccountResult = {
  statementCount: number;
  preparedStatements: PreparedStatement[];
};

export type ParseAccountResult = {
  rowCount: number;
  parsedPeriods: string[];
};

export type DeleteAccountResult = {
  bank: string;
  downloadDir: string;
  filesRemoved: number;
  dirsRemoved: number;
};
