import type { StatementEngine } from "@ndb/core";
import { createStatementEngine } from "@statements/api.ts";
import { statementPipelineRun } from "@statements/convert/statement-pipeline-run.ts";
import type { Pool } from "@statements/worker/pool.ts";

export function wrap(pool: Pool): StatementEngine {
  const local = createStatementEngine();

  return {
    listBanks() {
      return local.listBanks();
    },

    async processPipeline(context, dataKey, options) {
      return pool.run(
        {
          method: "processPipeline",
          run: statementPipelineRun.fromDomain(context),
          dataKey,
          debugTrace: options.pipelineTrace,
        },
        options.jobId
      );
    },

    async processUpload(context, accountId, format, statementDate, dataKey, options) {
      return pool.run(
        {
          method: "processUpload",
          run: statementPipelineRun.fromDomain(context),
          accountId,
          format,
          statementDate,
          dataKey,
          debugTrace: options.pipelineTrace,
        },
        options.jobId
      );
    },

    readAccountStatements(input) {
      return local.readAccountStatements(input);
    },

    readStatementTransactions(input) {
      return local.readStatementTransactions(input);
    },

    readStatementFile(input) {
      return local.readStatementFile(input);
    },

    statementFileExists(input) {
      return local.statementFileExists(input);
    },

    writeUpload(input) {
      return local.writeUpload(input);
    },

    async deleteAccountStatements(context, accountId, dataKey) {
      return pool.run({
        method: "deleteAccountStatements",
        run: statementPipelineRun.fromDomain(context),
        accountId,
        dataKey,
      });
    },
  };
}
