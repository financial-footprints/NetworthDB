import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import type { Account } from "@ndb/core";
import { getHandler } from "@statements/banks/handlers/index";
import { bobStatementTextMayBeIncomplete } from "@statements/banks/institutions/bob/shared/helpers";
import {
  decryptPdfFileInPlace,
  decryptPdfToBytes,
  extractPdfText,
  extractPdfTextFromBytes,
  pdfBytesLookEncrypted,
} from "@statements/ingest/pdf/index";
import { AlertKind, type AlertService, emitPdfOpenAlert } from "@statements/pipeline/jobs/alerts";
import type { MonthGroups } from "@statements/pipeline/stages/cleanup/models";
import { statementShouldExclude } from "@statements/pipeline/stages/cleanup/prepare-common";
import { periodFromManualUpload } from "@statements/pipeline/stages/upload/index";
import {
  isCsvPath,
  isPdfPath,
  iterPdfs,
  listMonthlyPdfRelatives,
  statementTxtRelative,
} from "@statements/storage/vault/path";
import type { VaultStore } from "@statements/storage/vault/store";

const METADATA_FILENAME = "metadata.json";

export function isStagingPdf(stagingDir: string, path: string): boolean {
  return (
    dirname(path) === stagingDir && existsSync(path) && statSync(path).isFile() && isPdfPath(path)
  );
}

export function isStagingCsv(stagingDir: string, path: string): boolean {
  return (
    dirname(path) === stagingDir && existsSync(path) && statSync(path).isFile() && isCsvPath(path)
  );
}

export function pruneUnsupportedStagingFiles(stagingDir: string): number {
  if (!existsSync(stagingDir) || !statSync(stagingDir).isDirectory()) {
    return 0;
  }

  let removed = 0;
  for (const entry of readdirSync(stagingDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "pdf" || ext === "csv" || entry.name === METADATA_FILENAME) {
      continue;
    }
    try {
      rmSync(`${stagingDir}/${entry.name}`);
      removed += 1;
    } catch {
      // ignore
    }
  }
  return removed;
}

export async function decryptPdfsInPlace(
  stagingDir: string,
  account: Account,
  alerts: AlertService
): Promise<number> {
  let decrypted = 0;
  for (const path of iterPdfs(stagingDir)) {
    try {
      await decryptPdfFileInPlace(path, account.passwords);
      const onDisk = readFileSync(path);
      if (pdfBytesLookEncrypted(onDisk)) {
        const decrypted = await decryptPdfToBytes(onDisk, account.passwords);
        writeFileSync(path, Buffer.from(decrypted));
      }
      await extractPdfText(path, account.passwords);
      if (pdfBytesLookEncrypted(readFileSync(path))) {
        throw new Error("staging pdf is still encrypted after qpdf decrypt");
      }
      decrypted += 1;
    } catch (error) {
      emitPdfOpenAlert(alerts, account, path, {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return decrypted;
}

export async function repairEncryptedVaultPdfs(
  store: VaultStore,
  account: Account,
  financialYear: string | null,
  alerts: AlertService
): Promise<number> {
  let repaired = 0;
  for (const pdfRelative of listMonthlyPdfRelatives(
    store,
    account.accountType,
    account.id,
    financialYear
  )) {
    const bytes = store.readBytes(pdfRelative);
    if (!bytes || !pdfBytesLookEncrypted(bytes)) {
      continue;
    }
    try {
      const decrypted = await decryptPdfToBytes(bytes, account.passwords);
      store.writeBytes(pdfRelative, decrypted);
      repaired += 1;
    } catch (error) {
      emitPdfOpenAlert(alerts, account, pdfRelative, {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return repaired;
}

async function writeMissingStatementTxt(
  store: VaultStore,
  account: Account,
  pdfRelative: string,
  alerts: AlertService
): Promise<boolean> {
  const stem = basename(pdfRelative, ".pdf");
  const txtRelative = statementTxtRelative(account.accountType, account.id, stem);
  if (store.exists(txtRelative)) {
    return false;
  }
  const pdfBytes = store.readBytes(pdfRelative);
  if (!pdfBytes || pdfBytesLookEncrypted(pdfBytes)) {
    return false;
  }
  try {
    const handler = getHandler(account.bank, account.variant ?? undefined);
    const raw = await extractPdfTextFromBytes(pdfBytes, account.passwords);
    const cleaned = handler.cleanText(raw);
    store.writeBytes(txtRelative, Buffer.from(cleaned, "utf8"));
    if (account.bank === "bob" && bobStatementTextMayBeIncomplete(cleaned)) {
      alerts.emit({
        kind: AlertKind.TextContainsMissing,
        message:
          "multi-page statement PDF has no extractable transaction lines; ledger may be empty for this period",
        account: `${account.bank}/${account.id}`,
        sourceFile: pdfRelative,
        textContains: ["Transaction Details"],
      });
    }
    return true;
  } catch (error) {
    emitPdfOpenAlert(alerts, account, pdfRelative, {
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function refreshVaultStatementTxtFromPdf(
  store: VaultStore,
  account: Account,
  financialYear: string | null,
  alerts: AlertService
): Promise<number> {
  let refreshed = 0;
  for (const pdfRelative of listMonthlyPdfRelatives(
    store,
    account.accountType,
    account.id,
    financialYear
  )) {
    if (await writeMissingStatementTxt(store, account, pdfRelative, alerts)) {
      refreshed += 1;
    }
  }
  return refreshed;
}

function pruneExcludedFromRawByPath(input: {
  stagingDir: string;
  account: Account;
  rawByPath: Map<string, string>;
  isStagingFile: (stagingDir: string, path: string) => boolean;
  sanitize: (raw: string) => string;
  compareSanitized: boolean;
}): number {
  let removed = 0;
  for (const [path, raw] of input.rawByPath) {
    if (!existsSync(path) || !input.isStagingFile(input.stagingDir, path)) {
      continue;
    }
    const filename = basename(path);
    if (periodFromManualUpload(filename)) {
      continue;
    }
    const sanitized = input.compareSanitized ? input.sanitize(raw) : raw;
    if (!statementShouldExclude(raw, sanitized, input.account, false)) {
      continue;
    }
    rmSync(path);
    removed += 1;
  }
  return removed;
}

export function pruneExcludedStaging(
  stagingDir: string,
  account: Account,
  collected: MonthGroups,
  csvCollected?: MonthGroups
): number {
  const handler = getHandler(account.bank, account.variant ?? undefined);
  let removed = pruneExcludedFromRawByPath({
    stagingDir,
    account,
    rawByPath: collected.rawByPath,
    isStagingFile: isStagingPdf,
    sanitize: (raw) => handler.cleanText(raw),
    compareSanitized: true,
  });

  if (csvCollected) {
    removed += pruneExcludedFromRawByPath({
      stagingDir,
      account,
      rawByPath: csvCollected.rawByPath,
      isStagingFile: isStagingCsv,
      sanitize: (raw) => raw,
      compareSanitized: false,
    });
  }

  return removed;
}
