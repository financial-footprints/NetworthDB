import { existsSync } from "node:fs";
import type { PipelineRun } from "@core/domains/account/statements/entities/pipeline";
import type {
  Bank,
  StatementList,
  StatementPipelineResult,
} from "@core/domains/account/statements/types";
import type {
  StatementEngine,
  StatementFileInput,
  WriteUploadInput,
} from "@core/ports/statement-engine";

const ONECARD_BANK: Bank = {
  key: "onecard-default",
  bank: "onecard",
  variant: null,
  accountType: "credit_card",
};

const emptyCoverage = {
  segments: [],
  gaps: [],
  months: [],
  periodCount: 0,
};

function emptyStatementList(): StatementList {
  return {
    available: false,
    statementCount: 0,
    formats: [],
    coverage: emptyCoverage,
    statements: [],
    balanceGaps: [],
  };
}

function fileKey(input: {
  userId: string;
  accountType: string;
  accountId: string;
  statementDate?: string;
  format: string;
}): string {
  return `${input.userId}:${input.accountType}:${input.accountId}:${input.statementDate ?? ""}:${input.format}`;
}

function pipelineSuccess(
  warnings: StatementPipelineResult["warnings"] = []
): StatementPipelineResult {
  return { ok: true, warnings };
}

function extractFailedWarning(
  message: string,
  accountId: string
): StatementPipelineResult["warnings"][number] {
  return {
    kind: "extract.failed",
    message,
    account: accountId,
    sourceFile: "",
    textContains: [],
  };
}

export function createInMemoryStatementEngine(): StatementEngine {
  const files = new Map<string, Buffer>();

  return {
    listBanks() {
      return [ONECARD_BANK];
    },

    async processPipeline(pipeline: PipelineRun, _shouldCancel) {
      for (const source of pipeline.sources) {
        if (source.type === "thunderbird" && !existsSync(source.profile)) {
          const message = `profile directory not found: ${source.profile}`;
          return pipelineSuccess([extractFailedWarning(message, pipeline.account.id)]);
        }
      }

      return pipelineSuccess();
    },

    async processUpload() {
      return pipelineSuccess();
    },

    readAccountStatements() {
      return emptyStatementList();
    },

    readStatementFile(input: StatementFileInput) {
      const key = fileKey(input);
      return files.get(key) ?? null;
    },

    statementFileExists(input: StatementFileInput) {
      const key = fileKey(input);
      return files.has(key);
    },

    async writeUpload(input: WriteUploadInput) {
      const key = fileKey({
        userId: input.userId,
        accountType: input.accountType,
        accountId: input.accountId,
        statementDate: input.statementDate,
        format: input.format,
      });
      files.set(key, Buffer.from(input.data));
      return { relative: `in-memory/${key}` };
    },

    async deleteAccountStatements() {
      return pipelineSuccess();
    },

    setTransactionsSync() {
      // no-op for API unit tests
    },
  };
}
