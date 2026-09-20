import { existsSync, statSync } from "node:fs";
import type { PipelineRun } from "@ndb/core";
import { openVaultStore, type StatementsEngineConfig } from "@statements/config/runtime";
import { raiseIfCancelled } from "@statements/engine/errors";
import { AlertService } from "@statements/pipeline/jobs/alerts";
import { pruneIneligible } from "@statements/pipeline/stages/cleanup/canonical";
import { collectStagingGroups } from "@statements/pipeline/stages/cleanup/grouping";
import type {
  CleanupAccountResult,
  PreparedStatement,
} from "@statements/pipeline/stages/cleanup/models";
import { sweepOrphans } from "@statements/pipeline/stages/cleanup/orphans";
import { prepareCsvMonth } from "@statements/pipeline/stages/cleanup/prepare-csv-month";
import {
  prepareMonth,
  shouldSkipCurrentPair,
} from "@statements/pipeline/stages/cleanup/prepare-month";
import {
  decryptPdfsInPlace,
  pruneExcludedStaging,
  pruneUnsupportedStagingFiles,
  refreshVaultStatementTxtFromPdf,
  repairEncryptedVaultPdfs,
} from "@statements/pipeline/stages/cleanup/staging";
import { manualUploadCsvPath, manualUploadPdfPath } from "@statements/pipeline/stages/upload/index";
import { statementRelativePath } from "@statements/storage/vault/path";
import { accountWorkspace, ensureDir } from "@statements/storage/vault/workspace";

export type {
  CleanupAccountResult,
  MonthGroups,
  PreparedStatement,
} from "@statements/pipeline/stages/cleanup/models";

function processPdfMonths(input: {
  collected: Awaited<ReturnType<typeof collectStagingGroups>>[0];
  stagingDir: string;
  store: ReturnType<typeof openVaultStore>;
  account: PipelineRun["account"];
  alerts: AlertService;
  shouldCancel?: () => boolean;
}): Promise<{
  prepared: number;
  rejected: number;
  preparedStatements: PreparedStatement[];
}> {
  return (async () => {
    let prepared = 0;
    let rejected = 0;
    const preparedStatements: PreparedStatement[] = [];

    for (const month of [...input.collected.groups.keys()].sort()) {
      raiseIfCancelled(input.shouldCancel);
      if (month === "unknown-month") {
        continue;
      }

      const candidates = input.collected.groups.get(month) ?? [];
      if (shouldSkipCurrentPair(input.store, input.account, month, candidates)) {
        continue;
      }

      const [monthPrepared, monthRejected, preparedStatement] = await prepareMonth(
        {
          stagingDir: input.stagingDir,
          store: input.store,
          month,
          candidates,
          account: input.account,
          rawByPath: input.collected.rawByPath,
          pathMonth: input.collected.pathMonth,
          pathHash: input.collected.pathHash,
          pathPeriodSource: input.collected.pathPeriodSource,
        },
        input.alerts
      );
      prepared += monthPrepared;
      rejected += monthRejected;
      if (preparedStatement) {
        preparedStatements.push(preparedStatement);
      }
    }

    return { prepared, rejected, preparedStatements };
  })();
}

function processCsvMonths(input: {
  csvCollected: Awaited<ReturnType<typeof collectStagingGroups>>[1];
  stagingDir: string;
  store: ReturnType<typeof openVaultStore>;
  account: PipelineRun["account"];
  alerts: AlertService;
  shouldCancel?: () => boolean;
}): {
  prepared: number;
  rejected: number;
  preparedStatements: PreparedStatement[];
} {
  let prepared = 0;
  let rejected = 0;
  const preparedStatements: PreparedStatement[] = [];

  for (const month of [...input.csvCollected.groups.keys()].sort()) {
    raiseIfCancelled(input.shouldCancel);
    if (month === "unknown-month") {
      continue;
    }

    const candidates = input.csvCollected.groups.get(month) ?? [];
    const csvRelative = statementRelativePath(
      input.account.accountType,
      input.account.id,
      month,
      "csv"
    );
    const extra = candidates.filter((path) => existsSync(path)).length;
    if (extra === 0 && input.store.exists(csvRelative)) {
      continue;
    }

    const [monthPrepared, monthRejected, preparedStatement] = prepareCsvMonth(
      {
        stagingDir: input.stagingDir,
        store: input.store,
        month,
        candidates,
        account: input.account,
        rawByPath: input.csvCollected.rawByPath,
        pathMonth: input.csvCollected.pathMonth,
        pathHash: input.csvCollected.pathHash,
        pathPeriodSource: input.csvCollected.pathPeriodSource,
      },
      input.alerts
    );
    prepared += monthPrepared;
    rejected += monthRejected;
    if (preparedStatement) {
      preparedStatements.push(preparedStatement);
    }
  }

  return { prepared, rejected, preparedStatements };
}

export async function runCleanup(
  pipeline: PipelineRun,
  config: StatementsEngineConfig,
  stagingDir: string,
  shouldCancel?: () => boolean
): Promise<CleanupAccountResult> {
  raiseIfCancelled(shouldCancel);
  ensureDir(stagingDir);

  const account = pipeline.account;
  const store = openVaultStore(config, pipeline.userId, pipeline.dataKey);
  const uploadStatementDate =
    pipeline.kind === "upload" ? (pipeline.upload?.statementDate ?? null) : null;

  const alerts = new AlertService();
  const vaultPdfsRepaired = await repairEncryptedVaultPdfs(
    store,
    account,
    pipeline.financialYear,
    alerts
  );
  await refreshVaultStatementTxtFromPdf(store, account, pipeline.financialYear, alerts);

  if (!existsSync(stagingDir) || !statSync(stagingDir).isDirectory()) {
    await refreshVaultStatementTxtFromPdf(store, account, pipeline.financialYear, alerts);
    const orphansRemoved = sweepOrphans(store, account, pipeline.financialYear);
    return {
      ...emptyResult(account.bank, stagingDir),
      decrypted: vaultPdfsRepaired,
      orphansRemoved,
      warnings: alerts.toStatementWarnings(),
    };
  }

  const unsupportedStagingRemoved = pruneUnsupportedStagingFiles(stagingDir);
  const decrypted = vaultPdfsRepaired + (await decryptPdfsInPlace(stagingDir, account, alerts));

  let pdfPaths: string[] | undefined;
  let csvPaths: string[] | undefined;
  if (uploadStatementDate) {
    const uploadPdfPath = manualUploadPdfPath(stagingDir, uploadStatementDate);
    const uploadCsvPath = manualUploadCsvPath(stagingDir, uploadStatementDate);
    pdfPaths = existsSync(uploadPdfPath) ? [uploadPdfPath] : [];
    csvPaths = existsSync(uploadCsvPath) ? [uploadCsvPath] : [];
  }

  const [collected, csvCollected] = await collectStagingGroups(
    stagingDir,
    account,
    pdfPaths,
    csvPaths,
    alerts
  );

  pruneExcludedStaging(stagingDir, account, collected, csvCollected);
  pruneIneligible(store, account, pipeline.financialYear);

  const pdfResult = await processPdfMonths({
    collected,
    stagingDir,
    store,
    account,
    alerts,
    shouldCancel,
  });
  let prepared = pdfResult.prepared;
  let rejected = pdfResult.rejected;
  const preparedStatements = [...pdfResult.preparedStatements];

  if (!uploadStatementDate) {
    const csvResult = processCsvMonths({
      csvCollected,
      stagingDir,
      store,
      account,
      alerts,
      shouldCancel,
    });
    prepared += csvResult.prepared;
    rejected += csvResult.rejected;
    preparedStatements.push(...csvResult.preparedStatements);
  }

  await refreshVaultStatementTxtFromPdf(store, account, pipeline.financialYear, alerts);

  const orphansRemoved = sweepOrphans(store, account, pipeline.financialYear);

  return {
    bank: account.bank,
    downloadDir: stagingDir,
    unsupportedStagingRemoved,
    decrypted,
    prepared,
    rejected,
    orphansRemoved,
    skipped: false,
    warnings: alerts.toStatementWarnings(),
    preparedStatements,
  };
}

function emptyResult(bank: string, stagingDir: string): CleanupAccountResult {
  return {
    bank,
    downloadDir: stagingDir,
    unsupportedStagingRemoved: 0,
    decrypted: 0,
    prepared: 0,
    rejected: 0,
    orphansRemoved: 0,
    skipped: true,
    warnings: [],
    preparedStatements: [],
  };
}

export function defaultStagingDir(pipeline: PipelineRun): string {
  return accountWorkspace(pipeline.userId, pipeline.account.accountType, pipeline.account.id);
}
