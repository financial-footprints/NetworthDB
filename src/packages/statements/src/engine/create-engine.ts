import { join } from "node:path";
import type { StatementEngine, UploadSourceFormat, WriteUploadInput } from "@ndb/core";
import { listHandlers } from "@statements/banks/handlers/index";
import type { BankHandlerKey } from "@statements/banks/handlers/registry";
import {
  ensureEngineDirectories,
  openVaultStore,
  type StatementsEngineConfig,
} from "@statements/config/runtime";
import { StageError } from "@statements/engine/errors";
import {
  processDeleteJob,
  processPipelineJob,
  processUploadJob,
} from "@statements/pipeline/jobs/process";
import { setTransactionsSyncForPeriod } from "@statements/pipeline/stages/metadata/transactions-sync";
import { saveManualUploadPdf, saveUploadedZip } from "@statements/pipeline/stages/upload/index";
import {
  readStatementFile,
  readStoredMetadata,
  statementFileExists,
  statementListFromStored,
} from "@statements/storage/read/index";
import { accountWorkspace, ensureDir, writeFile } from "@statements/storage/vault/workspace";

function createEngine(config: StatementsEngineConfig): StatementEngine {
  return {
    listBanks() {
      return listHandlers().map(({ bank, variant }: BankHandlerKey) => ({
        key: `${bank}/${variant}`,
        bank,
        variant: variant === "default" ? null : variant,
        accountType: "credit_card",
      }));
    },
    processPipeline(pipeline, shouldCancel, onLogLine) {
      return processPipelineJob(config, pipeline, shouldCancel, onLogLine);
    },
    processUpload(pipeline, shouldCancel, onLogLine) {
      return processUploadJob(config, pipeline, shouldCancel, onLogLine);
    },
    readAccountStatements(input) {
      const store = openVaultStore(config, input.userId, input.dataKey);
      const stored = readStoredMetadata(store, input.account);
      return statementListFromStored(stored, input.account, store);
    },
    readStatementFile(input) {
      const store = openVaultStore(config, input.userId, input.dataKey);
      return readStatementFile(store, input);
    },
    statementFileExists(input) {
      const store = openVaultStore(config, input.userId, input.dataKey);
      return statementFileExists(store, input, input.userId);
    },
    async writeUpload(input: WriteUploadInput) {
      const stagingDir = accountWorkspace(input.userId, input.accountType, input.accountId);
      ensureDir(stagingDir);
      const format = input.format as UploadSourceFormat;

      if (format === "pdf") {
        if (!input.statementDate) {
          throw new StageError("upload pdf requires statementDate");
        }
        const path = saveManualUploadPdf(stagingDir, input.statementDate, input.data);
        return { relative: path.split("/").pop() ?? path };
      }

      if (format === "csv") {
        if (!input.statementDate) {
          throw new StageError("upload csv requires statementDate");
        }
        const target = join(stagingDir, `manual__${input.statementDate}.csv`);
        writeFile(target, input.data);
        return { relative: target.split("/").pop() ?? target };
      }

      if (format === "zip") {
        const written = await saveUploadedZip(
          stagingDir,
          {
            bank: input.bank,
            variant: input.variant,
            passwords: input.passwords,
          },
          input.data
        );
        const relative = written[0]?.split("/").pop() ?? input.filename;
        return { relative };
      }

      throw new StageError(`unsupported upload format: ${input.format}`);
    },
    deleteAccountStatements(pipeline, onLogLine) {
      return processDeleteJob(config, pipeline, undefined, onLogLine);
    },
    setTransactionsSync(input) {
      const store = openVaultStore(config, input.userId, input.dataKey);
      setTransactionsSyncForPeriod(
        store,
        input.account,
        input.period,
        input.transactionsSynced,
        input.transactionsImportId
      );
    },
  };
}

export function createStatementEngine(config: StatementsEngineConfig): StatementEngine {
  ensureEngineDirectories(config);
  return createEngine(config);
}
