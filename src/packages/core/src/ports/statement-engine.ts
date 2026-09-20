import type { Account } from "@core/domains/account/entities/account";
import type { PipelineRun } from "@core/domains/account/statements/entities/pipeline";
import type {
  Bank,
  StatementList,
  StatementPipelineResult,
} from "@core/domains/account/statements/types";

export type StatementFileInput = {
  userId: string;
  dataKey: Buffer | null;
  accountType: string;
  accountId: string;
  format: string;
  statementDate?: string;
  filename?: string;
};

export type WriteUploadInput = {
  userId: string;
  dataKey: Buffer | null;
  accountType: string;
  accountId: string;
  format: string;
  statementDate?: string;
  filename: string;
  data: Buffer;
  passwords: string[];
  bank: string;
  variant: string | null;
};

export type StatementEngine = {
  listBanks(): Bank[];
  processPipeline(
    pipeline: PipelineRun,
    shouldCancel: () => boolean,
    onLogLine?: (line: string) => void
  ): Promise<StatementPipelineResult>;
  processUpload(
    pipeline: PipelineRun,
    shouldCancel: () => boolean,
    onLogLine?: (line: string) => void
  ): Promise<StatementPipelineResult>;
  readAccountStatements(input: {
    userId: string;
    dataKey: Buffer | null;
    account: Account;
  }): StatementList;
  readStatementFile(input: StatementFileInput): Buffer | null;
  statementFileExists(input: StatementFileInput): boolean;
  writeUpload(input: WriteUploadInput): Promise<{ relative: string }>;
  deleteAccountStatements(
    pipeline: PipelineRun,
    onLogLine?: (line: string) => void
  ): Promise<StatementPipelineResult>;
  setTransactionsSync(input: {
    userId: string;
    dataKey: Buffer | null;
    account: Account;
    period: string;
    transactionsSynced: boolean;
    transactionsImportId: string | null;
  }): void;
};
