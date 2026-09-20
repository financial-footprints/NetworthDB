import { join } from "node:path";
import { resolveKeyWithSource } from "@statements/banks/shared/period";
import { extractCsvsFromZip, sanitizeZipMemberName } from "@statements/ingest/zip/index";
import {
  isCalendarYearPeriod,
  isFyPeriod,
  parseMonthPeriod,
} from "@statements/period/statement-period";
import { uniquePath } from "@statements/storage/vault/path";
import { ensureDir, writeFile } from "@statements/storage/vault/workspace";

const MANUAL_UPLOAD_PREFIX = "manual__";
const MANUAL_UPLOAD_PATTERN = /^manual__(\d{4}-\d{2})\.(?:pdf|csv)$/i;
const MANUAL_ANNUAL_UPLOAD_PATTERN = /^manual__((?:FY\d{2}-\d{4})|(?:\d{4}))\.(?:pdf|csv)$/i;

export function periodFromManualUpload(filename: string): string | null {
  const name = filename.split(/[/\\]/).pop() ?? filename;
  const annualMatch = MANUAL_ANNUAL_UPLOAD_PATTERN.exec(name);
  if (annualMatch?.[1]) {
    return annualMatch[1];
  }
  const monthlyMatch = MANUAL_UPLOAD_PATTERN.exec(name);
  if (monthlyMatch?.[1]) {
    return monthlyMatch[1];
  }
  return null;
}

export function isValidStatementPeriod(period: string): boolean {
  return parseMonthPeriod(period) != null || isFyPeriod(period) || isCalendarYearPeriod(period);
}

export function manualUploadPdfPath(stagingDir: string, statementDate: string): string {
  return join(stagingDir, `${MANUAL_UPLOAD_PREFIX}${statementDate}.pdf`);
}

export function manualUploadCsvPath(stagingDir: string, statementDate: string): string {
  return join(stagingDir, `${MANUAL_UPLOAD_PREFIX}${statementDate}.csv`);
}

export function saveManualUploadPdf(
  workspaceDir: string,
  statementDate: string,
  content: Buffer
): string {
  ensureDir(workspaceDir);
  const target = manualUploadPdfPath(workspaceDir, statementDate);
  writeFile(target, content);
  return target;
}

export async function saveUploadedZip(
  workspaceDir: string,
  account: { bank: string; variant?: string | null; passwords: string[] },
  content: Buffer
): Promise<string[]> {
  const extracted = await extractCsvsFromZip(content, account.passwords);
  ensureDir(workspaceDir);
  const written: string[] = [];

  for (const item of extracted) {
    const csvText = item.content.toString("utf8");
    const [period] = resolveKeyWithSource(csvText, item.innerName, account);
    const stagingName =
      period !== "unknown-month" && isValidStatementPeriod(period)
        ? `${MANUAL_UPLOAD_PREFIX}${period}.csv`
        : `${MANUAL_UPLOAD_PREFIX}${sanitizeZipMemberName(item.innerName)}`;
    const target = uniquePath(workspaceDir, stagingName);
    writeFile(target, item.content);
    written.push(target);
  }

  return written;
}
