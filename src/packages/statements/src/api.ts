import type {
  StatementFileInput as CoreStatementFileInput,
  WriteUploadInput as CoreWriteUploadInput,
  StatementEngine,
} from "@ndb/core";
import { native } from "./client.ts";
import {
  account,
  bank,
  statementList,
  statementPipelineResult,
  statementPipelineRun,
  statementTransactions,
} from "./convert/index.ts";

export type StatementsRuntimeConfig = {
  filestorePath?: string;
  encryptAtRest?: boolean;
};

type NativeStatementFileInput = Parameters<typeof native.readStatementFile>[0];
type NativeWriteUploadInput = Parameters<typeof native.writeUpload>[0];

function toNativeStatementFileInput(input: CoreStatementFileInput): NativeStatementFileInput {
  return {
    userId: input.userId,
    dataKey: input.dataKey,
    accountType: input.accountType,
    accountId: input.accountId,
    format: input.format,
    statementDate: input.statementDate ?? null,
    filename: input.filename ?? null,
  };
}

function toNativeWriteUploadInput(input: CoreWriteUploadInput): NativeWriteUploadInput {
  return {
    ...input,
    statementDate: input.statementDate ?? null,
  };
}

export function initStatementsRuntime(config?: StatementsRuntimeConfig): void {
  native.initStatementsRuntime(config);
}

export function createStatementEngine(): StatementEngine {
  return {
    listBanks() {
      return native.listBanks().map(bank.toDomain);
    },

    async processPipeline(context, dataKey, options) {
      const result = native.processPipeline(
        statementPipelineRun.fromDomain(context),
        dataKey,
        options.pipelineTrace ?? false
      );
      return statementPipelineResult.toDomain(result);
    },

    async processUpload(context, accountId, format, statementDate, dataKey, options) {
      const result = native.processUpload(
        statementPipelineRun.fromDomain(context),
        { accountId, format, statementDate: statementDate ?? null },
        dataKey,
        options.pipelineTrace ?? false
      );
      return statementPipelineResult.toDomain(result);
    },

    readAccountStatements(input) {
      const result = native.readAccountStatements({
        userId: input.userId,
        dataKey: input.dataKey,
        account: account.fromDomain(input.account),
      });
      return statementList.toDomain(result);
    },

    readStatementTransactions(input) {
      const result = native.readAccountTransactions({
        userId: input.userId,
        dataKey: input.dataKey,
        account: account.fromDomain(input.account),
      });
      return statementTransactions.toDomain(result);
    },

    readStatementFile(input) {
      return native.readStatementFile(toNativeStatementFileInput(input));
    },

    statementFileExists(input) {
      return native.statementFileExists(toNativeStatementFileInput(input));
    },

    writeUpload(input) {
      return native.writeUpload(toNativeWriteUploadInput(input));
    },

    async deleteAccountStatements(context, accountId, dataKey) {
      const result = native.deleteAccountStatements(
        statementPipelineRun.fromDomain(context),
        accountId,
        dataKey
      );
      return statementPipelineResult.toDomain(result);
    },
  };
}
