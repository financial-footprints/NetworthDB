import type { Account } from "@core/domains/account/entities/account";
import type { PipelineContext } from "@core/domains/account/modules/statements/embedded/pipeline-context";
import type {
  Bank,
  StatementList,
  StatementPipelineResult,
  StatementTransactions,
} from "@core/domains/account/modules/statements/types";

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
};

export type StatementEngineJobOptions = {
  jobId: string;
  pipelineTrace?: boolean;
};

export type StatementEngine = {
  listBanks(): Bank[];
  processPipeline(
    context: PipelineContext,
    dataKey: Buffer | null,
    options: StatementEngineJobOptions
  ): Promise<StatementPipelineResult>;
  processUpload(
    context: PipelineContext,
    accountId: string,
    format: string,
    statementDate: string | null | undefined,
    dataKey: Buffer | null,
    options: StatementEngineJobOptions
  ): Promise<StatementPipelineResult>;
  readAccountStatements(input: {
    userId: string;
    dataKey: Buffer | null;
    account: Account;
  }): StatementList;
  readStatementTransactions(input: {
    userId: string;
    dataKey: Buffer | null;
    account: Account;
  }): StatementTransactions[];
  readStatementFile(input: StatementFileInput): Buffer | null;
  statementFileExists(input: StatementFileInput): boolean;
  writeUpload(input: WriteUploadInput): { relative: string };
  deleteAccountStatements(
    context: PipelineContext,
    accountId: string,
    dataKey: Buffer | null
  ): Promise<StatementPipelineResult>;
};
