import type { PipelineRun } from "@ndb/core";
import { openVaultStore, type StatementsEngineConfig } from "@statements/config/runtime";
import { raiseIfCancelled } from "@statements/engine/errors";
import { AlertService } from "@statements/pipeline/jobs/alerts";
import type {
  MetadataAccountResult,
  PreparedStatement,
} from "@statements/pipeline/stages/cleanup/models";
import { refreshVaultStatementTxtFromPdf } from "@statements/pipeline/stages/cleanup/staging";
import { refreshAccountMetadata } from "@statements/pipeline/stages/metadata/build";

export async function runMetadata(
  pipeline: PipelineRun,
  config: StatementsEngineConfig,
  prepared: PreparedStatement[],
  parsedPeriods: readonly string[],
  shouldCancel?: () => boolean
): Promise<MetadataAccountResult> {
  raiseIfCancelled(shouldCancel);
  const store = openVaultStore(config, pipeline.userId, pipeline.dataKey);
  const alerts = new AlertService();
  await refreshVaultStatementTxtFromPdf(store, pipeline.account, pipeline.financialYear, alerts);
  return refreshAccountMetadata(
    store,
    pipeline.account,
    pipeline.financialYear,
    prepared,
    parsedPeriods
  );
}
