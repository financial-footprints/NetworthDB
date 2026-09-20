import { existsSync, rmSync } from "node:fs";
import type { Account } from "@ndb/core";
import { textNotContainsViolated } from "@statements/banks/helpers/text";
import type { PeriodSource } from "@statements/banks/shared/period-source";
import { AlertKind, type AlertService } from "@statements/pipeline/jobs/alerts";
import { formatAmbiguousCandidates } from "@statements/pipeline/stages/cleanup/keeper";
import type { VaultStore } from "@statements/storage/vault/store";

export function statementShouldExclude(
  raw: string,
  sanitized: string,
  account: Account,
  isManual: boolean
): boolean {
  if (isManual) {
    return false;
  }
  const markers = account.statement?.textNotContains ?? [];
  return textNotContainsViolated(raw, markers) || textNotContainsViolated(sanitized, markers);
}

export type MonthPrepareInput = {
  stagingDir: string;
  store: VaultStore;
  month: string;
  candidates: string[];
  account: Account;
  rawByPath?: Map<string, string>;
  pathMonth?: Map<string, string>;
  pathHash?: Map<string, string>;
  pathPeriodSource?: Map<string, PeriodSource>;
};

export function filterExisting(candidates: string[]): string[] {
  return candidates.filter((path) => existsSync(path));
}

export function unlinkExcluded(unique: string[], shouldExclude: (path: string) => boolean): void {
  for (const path of unique) {
    if (!shouldExclude(path) || !existsSync(path)) {
      continue;
    }
    try {
      rmSync(path);
    } catch {
      // ignore
    }
  }
}

export function eligiblePaths(unique: string[], isEligible: (path: string) => boolean): string[] {
  return unique.filter((path) => existsSync(path) && isEligible(path));
}

export function reportAmbiguousPeriod(
  formatLabel: string,
  label: string,
  month: string,
  ambiguousPaths: string[],
  periodSourceLookup: Map<string, PeriodSource>,
  textContains: string[],
  alerts: AlertService
): void {
  const conflictSummary = formatAmbiguousCandidates(ambiguousPaths, periodSourceLookup);
  alerts.emit({
    kind: AlertKind.AmbiguousStatementPeriod,
    message: `multiple matching ${formatLabel}s with same period confidence for ${month}: ${conflictSummary}; manual review required`,
    account: label,
    sourceFile: month,
    textContains,
  });
}
