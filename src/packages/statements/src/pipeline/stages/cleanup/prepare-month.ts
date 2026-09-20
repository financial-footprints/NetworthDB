import { existsSync, rmSync } from "node:fs";
import { basename } from "node:path";
import type { Account } from "@ndb/core";
import { statementTextEligible, textContainsPresent } from "@statements/banks/helpers/text";
import {
  type PeriodSource,
  periodSourceForPath,
  periodSourceRank,
} from "@statements/banks/shared/period-source";
import { AlertKind, type AlertService, emitPdfOpenAlert } from "@statements/pipeline/jobs/alerts";
import {
  readPlaintextStagingPdfBytes,
  sanitizedText,
  writeStatementPair,
} from "@statements/pipeline/stages/cleanup/canonical";
import { dedupePathsByHash, fileHash } from "@statements/pipeline/stages/cleanup/grouping";
import { deletePdfDuplicates, selectKeeper } from "@statements/pipeline/stages/cleanup/keeper";
import type { PreparedStatement } from "@statements/pipeline/stages/cleanup/models";
import {
  eligiblePaths,
  filterExisting,
  type MonthPrepareInput,
  reportAmbiguousPeriod,
  statementShouldExclude,
  unlinkExcluded,
} from "@statements/pipeline/stages/cleanup/prepare-common";
import { periodFromManualUpload } from "@statements/pipeline/stages/upload/index";
import { statementRelativePath, statementTxtRelative } from "@statements/storage/vault/path";
import type { VaultStore } from "@statements/storage/vault/store";

function checkTextContains(
  text: string,
  textContains: string[],
  sourceFile: string,
  accountLabel: string,
  alerts: AlertService
): boolean {
  if (textContainsPresent(text, textContains)) {
    return true;
  }
  alerts.emit({
    kind: AlertKind.TextContainsMissing,
    message: `text_contains ${JSON.stringify(textContains)} not found in ${sourceFile}`,
    account: accountLabel,
    sourceFile,
    textContains,
  });
  return false;
}

function buildSanitizedByPath(
  unique: string[],
  rawByPath: Map<string, string> | undefined,
  account: Account
): Map<string, string> {
  const sanitizedByPath = new Map<string, string>();
  for (const path of unique) {
    sanitizedByPath.set(path, sanitizedText(rawByPath?.get(path) ?? "", account));
  }
  return sanitizedByPath;
}

function pathIsExcluded(
  path: string,
  rawByPath: Map<string, string> | undefined,
  sanitizedByPath: Map<string, string>,
  account: Account,
  manualPaths: Set<string>
): boolean {
  if (manualPaths.has(path)) {
    return false;
  }
  return statementShouldExclude(
    rawByPath?.get(path) ?? "",
    sanitizedByPath.get(path) ?? "",
    account,
    false
  );
}

type PruneNonKeepersInput = {
  eligible: string[];
  keeper: string;
  keeperIsManual: boolean;
  keeperRank: number;
  keeperDigest: string;
  sanitizedByPath: Map<string, string>;
  hashLookup: Map<string, string>;
  periodSourceLookup: Map<string, PeriodSource>;
  textContains: string[];
  label: string;
  alerts: AlertService;
};

function shouldAttemptPrune(input: PruneNonKeepersInput, path: string): boolean {
  if (input.keeperIsManual) {
    return false;
  }
  return textContainsPresent(input.sanitizedByPath.get(path) ?? "", input.textContains);
}

function alertSkippedPrune(input: PruneNonKeepersInput, path: string): void {
  if (input.textContains.length === 0 || input.keeperIsManual) {
    return;
  }
  checkTextContains(
    input.sanitizedByPath.get(path) ?? "",
    input.textContains,
    basename(path),
    input.label,
    input.alerts
  );
}

function removeDuplicateIfWorse(input: PruneNonKeepersInput, path: string): void {
  const pathRank = periodSourceRank(periodSourceForPath(path, input.periodSourceLookup));
  const pathDigest = input.hashLookup.get(path) ?? fileHash(path);
  if ((pathDigest === input.keeperDigest || pathRank > input.keeperRank) && existsSync(path)) {
    rmSync(path);
  }
}

function pruneEligibleNonKeepers(input: PruneNonKeepersInput): void {
  for (const path of input.eligible) {
    if (path === input.keeper) {
      continue;
    }
    if (!shouldAttemptPrune(input, path)) {
      alertSkippedPrune(input, path);
      continue;
    }
    removeDuplicateIfWorse(input, path);
  }
}

function reportEligibleWithoutKeeper(
  eligible: string[],
  sanitizedByPath: Map<string, string>,
  textContains: string[],
  canonicalExists: boolean,
  label: string,
  alerts: AlertService
): void {
  if (canonicalExists || textContains.length === 0) {
    return;
  }
  for (const path of eligible) {
    checkTextContains(sanitizedByPath.get(path) ?? "", textContains, basename(path), label, alerts);
  }
}

async function finalizeMonthAfterKeeper(
  input: MonthPrepareInput,
  pruneInput: PruneNonKeepersInput,
  keeper: string,
  raw: string
): Promise<[number, number, PreparedStatement | null]> {
  const { stagingDir, store, month, account, pathHash, pathMonth, pathPeriodSource } = input;
  const unique = pruneInput.eligible;

  pruneEligibleNonKeepers(pruneInput);

  const dedupeLookup = pathMonth ?? new Map(unique.map((path) => [path, month] as const));
  deletePdfDuplicates(stagingDir, month, dedupeLookup, keeper, pathHash, pathPeriodSource);

  let pdfBytes: Buffer;
  try {
    pdfBytes = await readPlaintextStagingPdfBytes(keeper, account);
  } catch (error) {
    emitPdfOpenAlert(pruneInput.alerts, account, keeper, {
      message: error instanceof Error ? error.message : String(error),
    });
    return [0, 1, null];
  }

  return [1, 0, writeStatementPair(store, stagingDir, account, month, keeper, raw, pdfBytes)];
}

export async function prepareMonth(
  input: MonthPrepareInput,
  alerts: AlertService
): Promise<[number, number, PreparedStatement | null]> {
  const { store, month, candidates, account, rawByPath, pathHash, pathPeriodSource } = input;

  const existing = filterExisting(candidates);
  if (existing.length === 0) {
    return [0, 0, null];
  }

  const unique = dedupePathsByHash(existing, pathHash);
  const sanitizedByPath = buildSanitizedByPath(unique, rawByPath, account);

  const periodSourceLookup = pathPeriodSource ?? new Map();
  const hashLookup = pathHash ?? new Map();
  const label = `${account.bank}/${account.id}`;
  const pdfRelative = statementRelativePath(account.accountType, account.id, month, "pdf");
  const canonicalExists = store.exists(pdfRelative);
  const textContains = account.statement?.textContains ?? [];
  const manualCandidates = unique.filter((path) => Boolean(periodFromManualUpload(basename(path))));
  const manualPaths = new Set(manualCandidates);

  unlinkExcluded(unique, (path) =>
    pathIsExcluded(path, rawByPath, sanitizedByPath, account, manualPaths)
  );

  const eligible = eligiblePaths(
    unique,
    (path) => !pathIsExcluded(path, rawByPath, sanitizedByPath, account, manualPaths)
  );

  if (eligible.length === 0) {
    return [0, 1, null];
  }

  const [keeper, ambiguousPaths] = selectKeeper(
    eligible,
    account,
    sanitizedByPath,
    periodSourceLookup,
    hashLookup,
    textContains,
    manualCandidates
  );

  if (ambiguousPaths.length > 0) {
    reportAmbiguousPeriod(
      "PDF",
      label,
      month,
      ambiguousPaths,
      periodSourceLookup,
      textContains,
      alerts
    );
    return [0, 1, null];
  }

  if (!keeper) {
    reportEligibleWithoutKeeper(
      eligible,
      sanitizedByPath,
      textContains,
      canonicalExists,
      label,
      alerts
    );
    return [0, 1, null];
  }

  const raw = rawByPath?.get(keeper) ?? "";
  const pruneInput: PruneNonKeepersInput = {
    eligible,
    keeper,
    keeperIsManual: manualPaths.has(keeper),
    keeperRank: periodSourceRank(periodSourceForPath(keeper, periodSourceLookup)),
    keeperDigest: hashLookup.get(keeper) ?? fileHash(keeper),
    sanitizedByPath,
    hashLookup,
    periodSourceLookup,
    textContains,
    label,
    alerts,
  };

  return finalizeMonthAfterKeeper(input, pruneInput, keeper, raw);
}

export function shouldSkipCurrentPair(
  store: VaultStore,
  account: Account,
  month: string,
  candidates: string[]
): boolean {
  const pdfRelative = statementRelativePath(account.accountType, account.id, month, "pdf");
  const txtRelative = statementTxtRelative(account.accountType, account.id, month);
  if (candidates.filter((path) => existsSync(path)).length > 0) {
    return false;
  }
  if (!store.exists(pdfRelative) || !store.exists(txtRelative)) {
    return false;
  }

  const txtContent = store.readBytes(txtRelative)?.toString("utf8") ?? "";
  if (statementShouldExclude(txtContent, txtContent, account, false)) {
    store.unlink(pdfRelative);
    store.unlink(txtRelative);
    return true;
  }

  if (
    statementTextEligible(
      txtContent,
      account.statement?.textContains ?? [],
      account.statement?.textNotContains ?? [],
      false
    )
  ) {
    return true;
  }

  store.unlink(pdfRelative);
  store.unlink(txtRelative);
  return true;
}
