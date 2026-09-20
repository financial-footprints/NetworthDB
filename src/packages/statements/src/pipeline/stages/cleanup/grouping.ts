import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import type { Account } from "@ndb/core";
import { resolveKeyWithSource, resolvePeriodKeyWithSource } from "@statements/banks/shared/period";
import { PeriodSource } from "@statements/banks/shared/period-source";
import { extractPdfText } from "@statements/ingest/pdf/index";
import { type AlertService, emitPdfOpenAlert } from "@statements/pipeline/jobs/alerts";
import type { MonthGroups } from "@statements/pipeline/stages/cleanup/models";
import { periodFromManualUpload } from "@statements/pipeline/stages/upload/index";

export function fileHash(path: string): string {
  const bytes = readFileSync(path);
  return createHash("sha256").update(bytes).digest("hex");
}

export function dedupePathsByHash(paths: string[], pathHash?: Map<string, string>): string[] {
  const seen = new Map<string, string>();
  for (const path of paths) {
    const digest = pathHash?.get(path) ?? fileHash(path);
    if (!seen.has(digest)) {
      seen.set(digest, path);
    }
  }
  return [...seen.values()];
}

type ResolvePeriodFn = (raw: string, filename: string, account: Account) => [string, PeriodSource];

async function readPathRaw(
  path: string,
  account: Account,
  readRaw: (path: string, account: Account) => Promise<string> | string,
  softReadFail: boolean,
  alerts?: AlertService
): Promise<string | null> {
  if (softReadFail) {
    try {
      return await extractPdfText(path, account.passwords);
    } catch (error) {
      if (alerts) {
        emitPdfOpenAlert(alerts, account, path, {
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return null;
    }
  }
  return readRaw(path, account);
}

async function processStagingPath(input: {
  path: string;
  account: Account;
  readRaw: (path: string, account: Account) => Promise<string> | string;
  resolvePeriod: ResolvePeriodFn;
  softReadFail: boolean;
  alerts?: AlertService;
  hashToRaw: Map<string, string>;
}): Promise<{
  raw: string;
  month: string;
  source: PeriodSource;
} | null> {
  const digest = fileHash(input.path);
  let raw: string;
  if (input.hashToRaw.has(digest)) {
    raw = input.hashToRaw.get(digest) ?? "";
  } else {
    const read = await readPathRaw(
      input.path,
      input.account,
      input.readRaw,
      input.softReadFail,
      input.alerts
    );
    if (read == null) {
      return null;
    }
    raw = read;
    input.hashToRaw.set(digest, raw);
  }

  const filename = basename(input.path);
  const [month, source] = periodFromManualUpload(filename)
    ? [periodFromManualUpload(filename) as string, PeriodSource.Manual]
    : input.resolvePeriod(raw, filename, input.account);

  return { raw, month, source };
}

function collectGroups(
  paths: string[],
  account: Account,
  readRaw: (path: string, account: Account) => Promise<string> | string,
  resolvePeriod: ResolvePeriodFn,
  softReadFail: boolean,
  alerts?: AlertService
): Promise<MonthGroups> {
  const byMonth = new Map<string, string[]>();
  const rawByPath = new Map<string, string>();
  const pathMonth = new Map<string, string>();
  const pathHashMap = new Map<string, string>();
  const pathPeriodSource = new Map<string, PeriodSource>();
  const seen = new Set<string>();
  const hashToRaw = new Map<string, string>();

  const sorted = [...paths].sort();

  return (async () => {
    for (const path of sorted) {
      if (seen.has(path)) {
        continue;
      }
      seen.add(path);

      const digest = fileHash(path);
      pathHashMap.set(path, digest);

      const processed = await processStagingPath({
        path,
        account,
        readRaw,
        resolvePeriod,
        softReadFail,
        alerts,
        hashToRaw,
      });
      if (!processed) {
        continue;
      }

      const { raw, month, source } = processed;
      rawByPath.set(path, raw);
      pathMonth.set(path, month);
      pathPeriodSource.set(path, source);
      const group = byMonth.get(month) ?? [];
      group.push(path);
      byMonth.set(month, group);
    }

    return {
      groups: byMonth,
      rawByPath,
      pathMonth,
      pathHash: pathHashMap,
      pathPeriodSource,
    };
  })();
}

function readCsvRaw(path: string): string {
  return readFileSync(path, "utf8");
}

export async function collectStagingGroups(
  stagingDir: string,
  account: Account,
  pdfPaths?: string[],
  csvPaths?: string[],
  alerts?: AlertService
): Promise<[MonthGroups, MonthGroups]> {
  const listStaging = (ext: ".pdf" | ".csv"): string[] => {
    if (!existsSync(stagingDir) || !statSync(stagingDir).isDirectory()) {
      return [];
    }
    return readdirSync(stagingDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(ext))
      .map((entry) => `${stagingDir}/${entry.name}`);
  };

  const resolvedPdfs = pdfPaths ?? listStaging(".pdf");
  const resolvedCsvs = csvPaths ?? listStaging(".csv");

  const pdfGroups = await collectGroups(
    resolvedPdfs,
    account,
    async (path) => extractPdfText(path, account.passwords),
    (raw, filename, acct) => resolvePeriodKeyWithSource(raw, filename, acct),
    true,
    alerts
  );

  const csvGroups = await collectGroups(
    resolvedCsvs,
    account,
    readCsvRaw,
    (raw, filename, acct) => resolveKeyWithSource(raw, filename, acct),
    false
  );

  return [pdfGroups, csvGroups];
}
