import { readFileSync, rmSync } from "node:fs";
import { basename } from "node:path";
import type { Account } from "@ndb/core";
import { getHandler } from "@statements/banks/handlers/index";
import { statementTextEligible } from "@statements/banks/helpers/text";
import { decryptPdfToBytes } from "@statements/ingest/pdf/decrypt";
import { assertPlaintextPdfBytes, pdfBytesLookEncrypted } from "@statements/ingest/pdf/helpers";
import { isCalendarYearPeriod, parseMonthPeriod } from "@statements/period/statement-period";
import type { PreparedStatement } from "@statements/pipeline/stages/cleanup/models";
import { statementShouldExclude } from "@statements/pipeline/stages/cleanup/prepare-common";
import { isStagingCsv, isStagingPdf } from "@statements/pipeline/stages/cleanup/staging";
import {
  listMonthlyPdfRelatives,
  statementRelativePath,
  statementTxtRelative,
} from "@statements/storage/vault/path";
import type { VaultStore } from "@statements/storage/vault/store";

export async function readPlaintextStagingPdfBytes(
  keeper: string,
  account: Account
): Promise<Buffer> {
  const pdfBytes = readFileSync(keeper);
  if (!pdfBytesLookEncrypted(pdfBytes)) {
    assertPlaintextPdfBytes(pdfBytes, keeper);
    return pdfBytes;
  }
  const decrypted = await decryptPdfToBytes(pdfBytes, account.passwords);
  assertPlaintextPdfBytes(decrypted, keeper);
  return decrypted;
}

export function sanitizedText(raw: string, account: Account): string {
  const handler = getHandler(account.bank, account.variant ?? undefined);
  return handler.cleanText(raw);
}

export function writeStatementPair(
  store: VaultStore,
  stagingDir: string,
  account: Account,
  month: string,
  keeper: string,
  raw: string,
  pdfBytes: Buffer
): PreparedStatement {
  const pdfRelative = statementRelativePath(account.accountType, account.id, month, "pdf");
  const txtRelative = statementTxtRelative(account.accountType, account.id, month);
  const purged = sanitizedText(raw, account);
  assertPlaintextPdfBytes(pdfBytes, keeper);

  if (!store.exists(pdfRelative)) {
    store.writeBytes(pdfRelative, pdfBytes);
  }
  store.writeBytes(txtRelative, Buffer.from(purged, "utf8"));

  if (isStagingPdf(stagingDir, keeper)) {
    rmSync(keeper);
  }

  return {
    period: month,
    cleanedText: purged,
    pdfBytes,
    sourceCsv: null,
  };
}

export function writeStatementCsv(
  store: VaultStore,
  stagingDir: string,
  account: Account,
  month: string,
  keeper: string
): PreparedStatement {
  const csvRelative = statementRelativePath(account.accountType, account.id, month, "csv");
  const csvBytes = readFileSync(keeper);
  if (!store.exists(csvRelative)) {
    store.writeBytes(csvRelative, csvBytes);
  }
  if (isStagingCsv(stagingDir, keeper)) {
    rmSync(keeper);
  }
  return {
    period: month,
    cleanedText: csvBytes.toString("utf8"),
    pdfBytes: null,
    sourceCsv: csvBytes,
  };
}

function pruneIneligiblePdfPair(
  store: VaultStore,
  account: Account,
  pdfRelative: string,
  textContains: string[],
  textNotContains: string[]
): number {
  const stem = basename(pdfRelative, ".pdf");
  const txtRelative = statementTxtRelative(account.accountType, account.id, stem);
  if (!store.exists(txtRelative)) {
    return 0;
  }
  const txtBytes = store.readBytes(txtRelative);
  if (!txtBytes) {
    return 0;
  }
  const txtContent = txtBytes.toString("utf8");
  if (statementShouldExclude(txtContent, txtContent, account, false)) {
    store.unlink(pdfRelative);
    store.unlink(txtRelative);
    return 1;
  }
  if (statementTextEligible(txtContent, textContains, textNotContains, false)) {
    return 0;
  }
  store.unlink(pdfRelative);
  store.unlink(txtRelative);
  return 1;
}

function pruneIneligibleCsv(
  store: VaultStore,
  account: Account,
  key: string,
  textContains: string[],
  textNotContains: string[]
): number {
  const stem = basename(key, ".csv");
  if (!parseMonthPeriod(stem) && !isCalendarYearPeriod(stem)) {
    return 0;
  }
  const csvBytes = store.readBytes(key);
  if (!csvBytes) {
    return 0;
  }
  const csvContent = csvBytes.toString("utf8");
  if (statementShouldExclude(csvContent, csvContent, account, false)) {
    store.unlink(key);
    return 1;
  }
  if (statementTextEligible(csvContent, textContains, textNotContains, false)) {
    return 0;
  }
  store.unlink(key);
  return 1;
}

export function pruneIneligible(
  store: VaultStore,
  account: Account,
  financialYear?: string | null
): number {
  const textContains = account.statement?.textContains ?? [];
  const textNotContains = account.statement?.textNotContains ?? [];
  let removed = 0;

  for (const pdfRelative of listMonthlyPdfRelatives(
    store,
    account.accountType,
    account.id,
    financialYear
  )) {
    removed += pruneIneligiblePdfPair(store, account, pdfRelative, textContains, textNotContains);
  }

  const segment = `/${account.accountType}/${account.id}/`;
  const prefix = financialYear
    ? `${financialYear}/${account.accountType}/${account.id}/`
    : undefined;
  for (const key of store.list(prefix)) {
    if (!key.includes(segment) || !key.endsWith(".csv") || key.includes("transactions-")) {
      continue;
    }
    removed += pruneIneligibleCsv(store, account, key, textContains, textNotContains);
  }

  return removed;
}
