import { existsSync } from "node:fs";
import type { PipelineContext } from "@core/domains/account/modules/statements/embedded/pipeline-context";
import type {
  Bank,
  StatementList,
  StatementPipelineResult,
  StatementTransactions,
} from "@core/domains/account/modules/statements/types";
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

function pipelineFailure(reason: string): StatementPipelineResult {
  return { ok: false, reason, warnings: [] };
}

function pipelineSuccess(): StatementPipelineResult {
  return { ok: true, warnings: [] };
}

export function createInMemoryStatementEngine(): StatementEngine {
  const files = new Map<string, Buffer>();

  return {
    listBanks() {
      return [ONECARD_BANK];
    },

    async processPipeline(context: PipelineContext, _dataKey, _options) {
      for (const source of context.sources) {
        if (source.type === "thunderbird" && !existsSync(source.profile)) {
          return pipelineFailure(`profile directory not found: ${source.profile}`);
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

    readStatementTransactions() {
      return [] as StatementTransactions[];
    },

    readStatementFile(input: StatementFileInput) {
      const key = fileKey(input);
      return files.get(key) ?? null;
    },

    statementFileExists(input: StatementFileInput) {
      const key = fileKey(input);
      return files.has(key);
    },

    writeUpload(input: WriteUploadInput) {
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
  };
}
