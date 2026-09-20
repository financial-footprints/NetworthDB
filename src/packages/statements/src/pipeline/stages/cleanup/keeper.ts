import { existsSync, rmSync } from "node:fs";
import { basename } from "node:path";
import type { Account } from "@ndb/core";
import { getHandler } from "@statements/banks/handlers/index";
import { textContainsPresent } from "@statements/banks/helpers/text";
import {
  type PeriodSource,
  periodSourceForPath,
  periodSourceRank,
} from "@statements/banks/shared/period-source";
import { emailDateFromStagingFilename } from "@statements/period/statement-period";
import { fileHash } from "@statements/pipeline/stages/cleanup/grouping";
import { isStagingCsv, isStagingPdf } from "@statements/pipeline/stages/cleanup/staging";
import { iterCsvs, iterPdfs } from "@statements/storage/vault/path";
import { parseISO } from "date-fns";

export function formatAmbiguousCandidates(
  paths: string[],
  pathPeriodSource: Map<string, PeriodSource>
): string {
  return [...paths]
    .sort()
    .map((path) => {
      const source = periodSourceForPath(path, pathPeriodSource);
      return `${basename(path)} (${source})`;
    })
    .join(", ");
}

function rankBestByPeriodAndHash(
  unique: string[],
  textByPath: Map<string, string>,
  pathPeriodSource: Map<string, PeriodSource>,
  pathHash: Map<string, string>,
  textContains: string[]
): [string | null, string[] | null] {
  const matching = unique.filter((path) => {
    const text = textByPath.get(path);
    return text ? textContainsPresent(text, textContains) : false;
  });
  if (matching.length === 0) {
    return [null, null];
  }

  matching.sort((a, b) => {
    const rankA = periodSourceRank(periodSourceForPath(a, pathPeriodSource));
    const rankB = periodSourceRank(periodSourceForPath(b, pathPeriodSource));
    return rankA - rankB || a.localeCompare(b);
  });

  const bestRank = periodSourceRank(periodSourceForPath(matching[0] as string, pathPeriodSource));
  const best = matching.filter(
    (path) => periodSourceRank(periodSourceForPath(path, pathPeriodSource)) === bestRank
  );
  if (best.length === 1) {
    return [best[0] ?? null, null];
  }

  const digests = new Set(best.map((path) => pathHash.get(path) ?? fileHash(path)));
  if (digests.size === 1) {
    return [best.at(-1) ?? null, null];
  }
  return [null, best];
}

export function selectKeeper(
  unique: string[],
  account: Account,
  sanitizedByPath: Map<string, string>,
  pathPeriodSource: Map<string, PeriodSource>,
  pathHash: Map<string, string>,
  textContains: string[],
  manualCandidates: string[]
): [string | null, string[]] {
  if (manualCandidates.length > 0) {
    return [manualCandidates.at(-1) ?? null, []];
  }
  if (textContains.length === 0) {
    return [unique.at(-1) ?? null, []];
  }

  const [resolved, remainder] = rankBestByPeriodAndHash(
    unique,
    sanitizedByPath,
    pathPeriodSource,
    pathHash,
    textContains
  );
  if (!remainder) {
    return [resolved, []];
  }

  const keeper = pickKeeperByRichnessThenEmail(remainder, sanitizedByPath, account);
  if (!keeper) {
    return [null, remainder];
  }
  return [keeper, []];
}

export function selectCsvKeeper(
  unique: string[],
  rawByPath: Map<string, string>,
  pathPeriodSource: Map<string, PeriodSource>,
  pathHash: Map<string, string>,
  textContains: string[]
): [string | null, string[]] {
  if (unique.length === 0) {
    return [null, []];
  }
  if (textContains.length === 0) {
    return [unique.at(-1) ?? null, []];
  }

  const [resolved, remainder] = rankBestByPeriodAndHash(
    unique,
    rawByPath,
    pathPeriodSource,
    pathHash,
    textContains
  );
  if (!remainder) {
    return [resolved, []];
  }

  const dated = remainder
    .map((path) => {
      const iso = emailDateFromStagingFilename(basename(path));
      const date = iso ? parseISO(iso) : null;
      return date ? ([path, date] as const) : null;
    })
    .filter((entry): entry is readonly [string, Date] => entry != null);

  if (dated.length > 0) {
    const latest = dated.reduce(
      (max, [, date]) => (date > max ? date : max),
      dated[0]?.[1] as Date
    );
    const latestPaths = dated
      .filter(([, date]) => date.getTime() === latest.getTime())
      .map(([path]) => path);
    return [latestPaths.at(-1) ?? null, []];
  }

  const preferred = [...remainder].sort((a, b) => {
    const manualA = basename(a).startsWith("manual__");
    const manualB = basename(b).startsWith("manual__");
    return Number(manualA) - Number(manualB) || a.localeCompare(b);
  });
  return [preferred.at(-1) ?? null, []];
}

function pickKeeperByRichnessThenEmail(
  candidates: string[],
  sanitizedByPath: Map<string, string>,
  account: Account
): string | null {
  const handler = getHandler(account.bank, account.variant ?? undefined);
  const richnessByPath = new Map(
    candidates.map((path) => {
      const text = sanitizedByPath.get(path) ?? "";
      const score = [
        handler.getStatementDate(text),
        handler.getOpeningBalance(text),
        handler.getClosingBalance(text),
      ].filter(Boolean).length;
      return [path, score] as const;
    })
  );

  const maxRichness = Math.max(...richnessByPath.values(), 0);
  const richest = candidates.filter((path) => (richnessByPath.get(path) ?? 0) === maxRichness);
  if (richest.length === 1) {
    return richest[0] ?? null;
  }

  const dated = richest
    .map((path) => {
      const iso = emailDateFromStagingFilename(basename(path));
      const date = iso ? parseISO(iso) : null;
      return date ? ([path, date] as const) : null;
    })
    .filter((entry): entry is readonly [string, Date] => entry != null);

  if (dated.length === 0) {
    return null;
  }

  const latest = dated.reduce((max, [, date]) => (date > max ? date : max), dated[0]?.[1] as Date);
  const latestPaths = dated
    .filter(([, date]) => date.getTime() === latest.getTime())
    .map(([path]) => path);
  return latestPaths.length === 1 ? (latestPaths[0] ?? null) : null;
}

function shouldDeleteDuplicatePath(options: {
  path: string;
  month: string;
  keep?: string;
  keepDigest?: string;
  keepRank?: number;
  pathMonth: Map<string, string>;
  pathHash?: Map<string, string>;
  pathPeriodSource?: Map<string, PeriodSource>;
  isStagingFile: (stagingDir: string, path: string) => boolean;
  stagingDir: string;
}): boolean {
  if (!options.isStagingFile(options.stagingDir, options.path)) {
    return false;
  }
  if (options.pathMonth.get(options.path) !== options.month) {
    return false;
  }
  if (options.keep && options.path === options.keep) {
    return false;
  }
  if (options.keepRank != null && options.pathPeriodSource) {
    const pathRank = periodSourceRank(periodSourceForPath(options.path, options.pathPeriodSource));
    const pathDigest = options.pathHash?.get(options.path) ?? fileHash(options.path);
    if (options.keepDigest && pathDigest !== options.keepDigest && pathRank <= options.keepRank) {
      return false;
    }
  }
  return existsSync(options.path);
}

function deleteDuplicates(options: {
  stagingDir: string;
  month: string;
  pathMonth: Map<string, string>;
  iterPaths: (dir: string) => string[];
  isStagingFile: (stagingDir: string, path: string) => boolean;
  keep?: string;
  pathHash?: Map<string, string>;
  pathPeriodSource?: Map<string, PeriodSource>;
}): number {
  let removed = 0;
  const keepDigest = options.keep
    ? (options.pathHash?.get(options.keep) ?? fileHash(options.keep))
    : undefined;
  const keepRank =
    options.keep && options.pathPeriodSource
      ? periodSourceRank(periodSourceForPath(options.keep, options.pathPeriodSource))
      : undefined;

  for (const path of options.iterPaths(options.stagingDir)) {
    if (
      !shouldDeleteDuplicatePath({
        path,
        month: options.month,
        keep: options.keep,
        keepDigest,
        keepRank,
        pathMonth: options.pathMonth,
        pathHash: options.pathHash,
        pathPeriodSource: options.pathPeriodSource,
        isStagingFile: options.isStagingFile,
        stagingDir: options.stagingDir,
      })
    ) {
      continue;
    }
    rmSync(path);
    removed += 1;
  }
  return removed;
}

export function deletePdfDuplicates(
  stagingDir: string,
  month: string,
  pathMonth: Map<string, string>,
  keep?: string,
  pathHash?: Map<string, string>,
  pathPeriodSource?: Map<string, PeriodSource>
): number {
  return deleteDuplicates({
    stagingDir,
    month,
    pathMonth,
    iterPaths: iterPdfs,
    isStagingFile: isStagingPdf,
    keep,
    pathHash,
    pathPeriodSource,
  });
}

export function deleteCsvDuplicates(
  stagingDir: string,
  month: string,
  pathMonth: Map<string, string>,
  keep?: string,
  pathHash?: Map<string, string>,
  pathPeriodSource?: Map<string, PeriodSource>
): number {
  return deleteDuplicates({
    stagingDir,
    month,
    pathMonth,
    iterPaths: iterCsvs,
    isStagingFile: isStagingCsv,
    keep,
    pathHash,
    pathPeriodSource,
  });
}
