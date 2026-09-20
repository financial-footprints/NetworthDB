import type { Logger, PipelineRun } from "@ndb/core";
import type { StatementsEngineConfig } from "@statements/config/runtime";
import { JobCancelledError, raiseIfCancelled } from "@statements/engine/errors";
import type { PipelineResult } from "@statements/engine/types";
import { defaultStagingDir, runCleanup } from "@statements/pipeline/stages/cleanup/index";
import { runExtract } from "@statements/pipeline/stages/extract/index";
import type { ExtractStageResult } from "@statements/pipeline/stages/extract/types";
import { runMetadata } from "@statements/pipeline/stages/metadata/index";
import { runParse } from "@statements/pipeline/stages/parse/index";
import { ensureDir } from "@statements/storage/vault/workspace";

export async function runPipeline(
  pipeline: PipelineRun,
  config: StatementsEngineConfig,
  log: Logger,
  shouldCancel?: () => boolean
): Promise<PipelineResult> {
  const stagingDir = defaultStagingDir(pipeline);
  ensureDir(stagingDir);

  let extract: ExtractStageResult | undefined;
  let extractFailedReason: string | undefined;
  if (pipeline.kind === "sync") {
    log.info("extract.started", { stage: "extract" });
    try {
      extract = await runExtract(pipeline, config, log, shouldCancel);
      const accounts = extract.accounts;
      const messagesMatched = accounts.reduce((sum, account) => sum + account.messagesMatched, 0);
      const attachmentsSaved = accounts.reduce((sum, account) => sum + account.attachmentsSaved, 0);
      log.info("extract.completed", {
        stage: "extract",
        messagesMatched,
        attachmentsSaved,
      });
    } catch (error) {
      if (error instanceof JobCancelledError) {
        throw error;
      }
      raiseIfCancelled(shouldCancel);
      extractFailedReason = error instanceof Error ? error.message : String(error);
      log.error("extract.failed", { stage: "extract", error: extractFailedReason });
    }
  }

  log.info("cleanup.started", { stage: "cleanup" });
  const cleanup = await runCleanup(pipeline, config, stagingDir, shouldCancel);
  log.info("cleanup.completed", {
    stage: "cleanup",
    prepared: cleanup.prepared,
    warningCount: cleanup.warnings.length,
  });

  log.info("parse.started", { stage: "parse" });
  const parse = await runParse(pipeline, config, cleanup.preparedStatements, shouldCancel);
  log.info("parse.completed", {
    stage: "parse",
    rowCount: parse.rowCount,
    parsedPeriods: parse.parsedPeriods.length,
  });

  log.info("metadata.started", { stage: "metadata" });
  const metadata = await runMetadata(
    pipeline,
    config,
    cleanup.preparedStatements,
    parse.parsedPeriods,
    shouldCancel
  );
  log.info("metadata.completed", {
    stage: "metadata",
    statementCount: metadata.statementCount,
  });

  return {
    extract,
    extractFailedReason,
    cleanup,
    metadata,
    parse,
  };
}

export async function runUploadPipeline(
  pipeline: PipelineRun,
  config: StatementsEngineConfig,
  log: Logger,
  shouldCancel?: () => boolean
): Promise<Omit<PipelineResult, "extract">> {
  const stagingDir = defaultStagingDir(pipeline);
  ensureDir(stagingDir);

  log.info("cleanup.started", { stage: "cleanup" });
  const cleanup = await runCleanup(pipeline, config, stagingDir, shouldCancel);
  log.info("cleanup.completed", {
    stage: "cleanup",
    prepared: cleanup.prepared,
    warningCount: cleanup.warnings.length,
  });

  log.info("parse.started", { stage: "parse" });
  const parse = await runParse(pipeline, config, cleanup.preparedStatements, shouldCancel);
  log.info("parse.completed", {
    stage: "parse",
    rowCount: parse.rowCount,
    parsedPeriods: parse.parsedPeriods.length,
  });

  log.info("metadata.started", { stage: "metadata" });
  const metadata = await runMetadata(
    pipeline,
    config,
    cleanup.preparedStatements,
    parse.parsedPeriods,
    shouldCancel
  );
  log.info("metadata.completed", {
    stage: "metadata",
    statementCount: metadata.statementCount,
  });

  return { cleanup, metadata, parse };
}
