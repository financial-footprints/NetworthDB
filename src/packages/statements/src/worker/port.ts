import type { PipelineRun, StatementEngine } from "@ndb/core";
import type { StatementsEngineConfig } from "@statements/config/runtime";
import { createStatementEngine } from "@statements/engine/create-engine";
import { serializePipelineRun } from "@statements/pipeline/jobs/serde";
import type { Pool } from "@statements/worker/pool";

export function wrap(pool: Pool, config: StatementsEngineConfig): StatementEngine {
  const local = createStatementEngine(config);

  return {
    listBanks() {
      return local.listBanks();
    },
    readAccountStatements(input) {
      return local.readAccountStatements(input);
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
    processPipeline(pipeline: PipelineRun, _shouldCancel, onLogLine) {
      return pool.run(
        {
          method: "processPipeline",
          pipeline: serializePipelineRun(pipeline),
        },
        pipeline.jobId,
        onLogLine
      );
    },
    processUpload(pipeline: PipelineRun, _shouldCancel, onLogLine) {
      return pool.run(
        {
          method: "processUpload",
          pipeline: serializePipelineRun(pipeline),
        },
        pipeline.jobId,
        onLogLine
      );
    },
    deleteAccountStatements(pipeline: PipelineRun, onLogLine) {
      return pool.run(
        {
          method: "deleteAccountStatements",
          pipeline: serializePipelineRun(pipeline),
        },
        pipeline.jobId,
        onLogLine
      );
    },
    setTransactionsSync(input) {
      return local.setTransactionsSync(input);
    },
  };
}
