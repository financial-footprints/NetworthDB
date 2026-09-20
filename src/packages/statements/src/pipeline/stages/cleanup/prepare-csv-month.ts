import type { AlertService } from "@statements/pipeline/jobs/alerts";
import { writeStatementCsv } from "@statements/pipeline/stages/cleanup/canonical";
import { dedupePathsByHash } from "@statements/pipeline/stages/cleanup/grouping";
import { deleteCsvDuplicates, selectCsvKeeper } from "@statements/pipeline/stages/cleanup/keeper";
import type { PreparedStatement } from "@statements/pipeline/stages/cleanup/models";
import {
  eligiblePaths,
  filterExisting,
  type MonthPrepareInput,
  reportAmbiguousPeriod,
  statementShouldExclude,
  unlinkExcluded,
} from "@statements/pipeline/stages/cleanup/prepare-common";
import { statementRelativePath } from "@statements/storage/vault/path";

export function prepareCsvMonth(
  input: MonthPrepareInput,
  alerts: AlertService
): [number, number, PreparedStatement | null] {
  const {
    stagingDir,
    store,
    month,
    candidates,
    account,
    rawByPath,
    pathMonth,
    pathHash,
    pathPeriodSource,
  } = input;

  const existing = filterExisting(candidates);
  if (existing.length === 0) {
    return [0, 0, null];
  }

  const unique = dedupePathsByHash(existing, pathHash);
  const periodSourceLookup = pathPeriodSource ?? new Map();
  const hashLookup = pathHash ?? new Map();
  const label = `${account.bank}/${account.id}`;
  const csvRelative = statementRelativePath(account.accountType, account.id, month, "csv");
  const textContains = account.statement?.textContains ?? [];
  const rawLookup = rawByPath ?? new Map<string, string>();

  const excluded = new Set(
    unique.filter((path) =>
      statementShouldExclude(rawLookup.get(path) ?? "", rawLookup.get(path) ?? "", account, false)
    )
  );

  unlinkExcluded(unique, (path) => excluded.has(path));
  const eligible = eligiblePaths(unique, (path) => !excluded.has(path));
  if (eligible.length === 0) {
    return [0, 1, null];
  }

  const [keeper, ambiguousPaths] = selectCsvKeeper(
    eligible,
    rawLookup,
    periodSourceLookup,
    hashLookup,
    textContains
  );

  if (ambiguousPaths.length > 0) {
    reportAmbiguousPeriod(
      "CSV",
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
    return [0, 1, null];
  }

  if (!store.exists(csvRelative)) {
    const dedupeLookup = pathMonth ?? new Map(unique.map((path) => [path, month] as const));
    deleteCsvDuplicates(stagingDir, month, dedupeLookup, keeper, pathHash, pathPeriodSource);
    return [1, 0, writeStatementCsv(store, stagingDir, account, month, keeper)];
  }

  return [0, 0, null];
}
