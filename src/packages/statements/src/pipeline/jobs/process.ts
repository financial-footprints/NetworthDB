/** Pipeline job orchestration for sync, upload, and delete. */
import type { Logger, PipelineRun, StatementPipelineResult } from "@ndb/core";
import { createLogger } from "@ndb/logger";
import type { StatementsEngineConfig } from "@statements/config/runtime";
import { JobCancelledError } from "@statements/engine/errors";
import { cancelledResult, toStatementPipelineResult } from "@statements/pipeline/jobs/result";
import { runPipeline, runUploadPipeline } from "@statements/pipeline/jobs/runner";
import { runDelete } from "@statements/pipeline/stages/delete/index";

function jobLogger(
  pipeline: PipelineRun,
  config: StatementsEngineConfig,
  onLogLine?: (line: string) => void
): Logger {
  return createLogger({
    level: config.logLevel,
    app: "statements",
    environment: config.environment,
    defaultContext: {
      jobId: pipeline.jobId,
      accountId: pipeline.account.id,
    },
    onLine: pipeline.trace ? onLogLine : undefined,
  });
}

function failureResult(error: unknown): StatementPipelineResult {
  if (error instanceof JobCancelledError) {
    return cancelledResult();
  }
  const reason = error instanceof Error ? error.message : String(error);
  return toStatementPipelineResult({ ok: false, reason });
}

export async function processPipelineJob(
  config: StatementsEngineConfig,
  pipeline: PipelineRun,
  shouldCancel?: () => boolean,
  onLogLine?: (line: string) => void
): Promise<StatementPipelineResult> {
  const log = jobLogger(pipeline, config, onLogLine);
  log.info("pipeline.started", { stage: "pipeline", kind: pipeline.kind });
  try {
    const result = await runPipeline(pipeline, config, log, shouldCancel);
    const warnings = [...(result.cleanup?.warnings ?? [])];
    if (result.extractFailedReason) {
      warnings.push({
        kind: "extract.failed",
        message: result.extractFailedReason,
        account: pipeline.account.id,
        sourceFile: "",
        textContains: [],
      });
    }
    log.info("pipeline.completed", {
      stage: "pipeline",
      warningCount: warnings.length,
      rowCount: result.parse?.rowCount ?? 0,
    });
    return toStatementPipelineResult({ ok: true, warnings });
  } catch (error) {
    log.error("pipeline.failed", { stage: "pipeline", error: String(error) });
    return failureResult(error);
  }
}

export async function processUploadJob(
  config: StatementsEngineConfig,
  pipeline: PipelineRun,
  shouldCancel?: () => boolean,
  onLogLine?: (line: string) => void
): Promise<StatementPipelineResult> {
  const log = jobLogger(pipeline, config, onLogLine);
  log.info("upload.started", { stage: "upload", format: pipeline.upload?.format });
  try {
    const result = await runUploadPipeline(pipeline, config, log, shouldCancel);
    const warnings = result.cleanup?.warnings ?? [];
    log.info("upload.completed", {
      stage: "upload",
      warningCount: warnings.length,
      rowCount: result.parse?.rowCount ?? 0,
    });
    return toStatementPipelineResult({ ok: true, warnings });
  } catch (error) {
    log.error("upload.failed", { stage: "upload", error: String(error) });
    return failureResult(error);
  }
}

export async function processDeleteJob(
  config: StatementsEngineConfig,
  pipeline: PipelineRun,
  shouldCancel?: () => boolean,
  onLogLine?: (line: string) => void
): Promise<StatementPipelineResult> {
  const log = jobLogger(pipeline, config, onLogLine);
  log.info("delete.started", { stage: "delete" });
  try {
    const result = await runDelete(pipeline, config, shouldCancel);
    log.info("delete.completed", {
      stage: "delete",
      filesRemoved: result.filesRemoved,
    });
    return toStatementPipelineResult({ ok: true });
  } catch (error) {
    log.error("delete.failed", { stage: "delete", error: String(error) });
    return failureResult(error);
  }
}
