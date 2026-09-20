import type { Logger, PipelineRun } from "@ndb/core";
import type { StatementsEngineConfig } from "@statements/config/runtime";
import { raiseIfCancelled, StageError } from "@statements/engine/errors";
import { runImapExtract } from "@statements/pipeline/stages/extract/imap";
import { runThunderbirdAccount } from "@statements/pipeline/stages/extract/thunderbird";
import type { ExtractStageResult } from "@statements/pipeline/stages/extract/types";

export type {
  ExtractAccountResult,
  ExtractStageResult,
} from "@statements/pipeline/stages/extract/types";

export async function runExtract(
  pipeline: PipelineRun,
  config: StatementsEngineConfig,
  log: Logger,
  shouldCancel?: () => boolean
): Promise<ExtractStageResult> {
  raiseIfCancelled(shouldCancel);

  if (pipeline.sources.length === 0) {
    throw new StageError("no statement sources configured");
  }

  const trace = pipeline.trace
    ? (event: string, fields: Record<string, unknown>) => {
        log.info(event, { stage: "extract", ...fields });
      }
    : undefined;

  const results = [];
  for (const source of pipeline.sources) {
    raiseIfCancelled(shouldCancel);
    if (source.type === "thunderbird") {
      results.push(
        await runThunderbirdAccount({
          config,
          account: pipeline.account,
          source,
          dataKey: pipeline.dataKey,
          shouldCancel,
        })
      );
      continue;
    }

    const batch = await runImapExtract({
      config,
      accounts: [pipeline.account],
      source,
      dataKey: pipeline.dataKey,
      shouldCancel,
      trace,
    });
    results.push(...batch);
  }

  return { accounts: results };
}
