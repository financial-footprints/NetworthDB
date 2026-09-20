import type { Account } from "@ndb/core";
import { getHandler } from "@statements/banks/handlers/index";
import { formatAccountDate, parseAccountDateStr } from "@statements/period/account-dates";
import { approxStartFromEnd } from "@statements/period/billing-period";
import { parseMonthPeriod } from "@statements/period/statement-period";
import type {
  MetadataAccountResult,
  PreparedStatement,
} from "@statements/pipeline/stages/cleanup/models";
import { buildPeriodCovered, coveredMonth } from "@statements/pipeline/stages/metadata/coverage";
import type {
  StatementMetadata,
  StoredAccountMetadata,
} from "@statements/pipeline/stages/metadata/stored";
import {
  forceTransactionsUnsynced,
  mergePreservedTransactionsSync,
} from "@statements/pipeline/stages/metadata/transactions-sync";
import {
  accountMetadataRelative,
  listMonthlyPdfRelatives,
  listMonthlyStatementCsvRelatives,
  listMonthlyTransactionsCsvRelatives,
  statementCsvPeriodStem,
  statementTxtRelative,
  transactionsCsvPeriodStem,
} from "@statements/storage/vault/path";
import {
  statementFormatsFromVault,
  unionStatementFormats,
} from "@statements/storage/vault/statement-formats";
import type { VaultStore } from "@statements/storage/vault/store";
import { format } from "date-fns";

function resolvePeriodBounds(
  text: string,
  account: Account
): [string | null, string | null, boolean] {
  const handler = getHandler(account.bank, account.variant ?? undefined);
  let [start, end] = handler.getStatementPeriod(text);
  if (start && end) {
    if (start > end) {
      [start, end] = [end, start];
    }
    return [formatAccountDate(start), formatAccountDate(end), false];
  }
  if (!end) {
    return [null, null, false];
  }
  const approxStart = parseAccountDateStr(approxStartFromEnd(format(end, "yyyy-MM-dd")));
  return [approxStart ? formatAccountDate(approxStart) : null, formatAccountDate(end), true];
}

function metadataForPeriod(
  store: VaultStore,
  account: Account,
  period: string,
  text: string | null
): StatementMetadata {
  let opening: string | null = null;
  let closing: string | null = null;
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  let periodApproximate = false;

  if (text) {
    const handler = getHandler(account.bank, account.variant ?? undefined);
    opening = handler.getOpeningBalance(text);
    closing = handler.getClosingBalance(text);
    [periodStart, periodEnd, periodApproximate] = resolvePeriodBounds(text, account);
  }

  return {
    statement_date: period,
    formats: statementFormatsFromVault(store, account.accountType, account.id, period),
    opening_balance: opening,
    closing_balance: closing,
    period_start: periodStart,
    period_end: periodEnd,
    period_approximate: periodApproximate,
    granularity: "monthly",
    covered_months: [coveredMonth(period)],
    year_key: null,
    transactions_synced: false,
    transactions_import_id: null,
  };
}

function rememberPeriod(
  statements: StatementMetadata[],
  seenPeriods: Set<string>,
  metadata: StatementMetadata | null
): void {
  if (!metadata || seenPeriods.has(metadata.statement_date)) {
    return;
  }
  seenPeriods.add(metadata.statement_date);
  statements.push(metadata);
}

function buildStoredPdfMetadata(
  store: VaultStore,
  account: Account,
  pdfRelative: string
): StatementMetadata | null {
  const stem =
    pdfRelative
      .split("/")
      .pop()
      ?.replace(/\.pdf$/i, "") ?? "";
  if (!parseMonthPeriod(stem)) {
    return null;
  }

  const txtRelative = statementTxtRelative(account.accountType, account.id, stem);
  const txtBytes = store.readBytes(txtRelative);
  const text = txtBytes ? txtBytes.toString("utf8") : null;
  return metadataForPeriod(store, account, stem, text);
}

function buildStoredCsvMetadata(
  store: VaultStore,
  account: Account,
  csvRelative: string
): StatementMetadata | null {
  const stem = statementCsvPeriodStem(csvRelative);
  if (!stem) {
    return null;
  }
  const csvBytes = store.readBytes(csvRelative);
  const text = csvBytes ? csvBytes.toString("utf8") : null;
  return metadataForPeriod(store, account, stem, text);
}

function buildStoredTransactionsMetadata(
  store: VaultStore,
  account: Account,
  csvRelative: string
): StatementMetadata | null {
  const stem = transactionsCsvPeriodStem(csvRelative);
  if (!stem) {
    return null;
  }
  return metadataForPeriod(store, account, stem, null);
}

export function buildAccountMetadata(
  store: VaultStore,
  account: Account,
  financialYear: string | null,
  prepared: PreparedStatement[]
): StoredAccountMetadata {
  const statements: StatementMetadata[] = [];
  const seenPeriods = new Set<string>();

  for (const preparedStmt of prepared) {
    if (!preparedStmt.pdfBytes && !preparedStmt.sourceCsv) {
      continue;
    }
    rememberPeriod(
      statements,
      seenPeriods,
      metadataForPeriod(store, account, preparedStmt.period, preparedStmt.cleanedText)
    );
  }

  for (const pdfRelative of listMonthlyPdfRelatives(
    store,
    account.accountType,
    account.id,
    financialYear
  )) {
    rememberPeriod(statements, seenPeriods, buildStoredPdfMetadata(store, account, pdfRelative));
  }

  for (const csvRelative of listMonthlyStatementCsvRelatives(
    store,
    account.accountType,
    account.id,
    financialYear
  )) {
    rememberPeriod(statements, seenPeriods, buildStoredCsvMetadata(store, account, csvRelative));
  }

  for (const csvRelative of listMonthlyTransactionsCsvRelatives(
    store,
    account.accountType,
    account.id,
    financialYear
  )) {
    rememberPeriod(
      statements,
      seenPeriods,
      buildStoredTransactionsMetadata(store, account, csvRelative)
    );
  }

  statements.sort((a, b) => a.statement_date.localeCompare(b.statement_date));
  const statementDates = statements.map((statement) => statement.statement_date);
  for (const statement of statements) {
    statement.formats = statementFormatsFromVault(
      store,
      account.accountType,
      account.id,
      statement.statement_date
    );
  }

  return {
    account_id: account.id,
    bank: account.bank,
    variant: account.variant,
    account_type: account.accountType,
    opening_date: account.openingDate,
    closing_date: account.closingDate,
    formats: unionStatementFormats(statements),
    statements,
    statement_dates: statementDates,
    starting: statementDates[0] ?? null,
    ending: statementDates.at(-1) ?? null,
    statement_count: statementDates.length,
    period_covered: buildPeriodCovered(statements),
  };
}

export function writeAccountMetadata(
  store: VaultStore,
  account: Account,
  metadata: StoredAccountMetadata
): void {
  const relative = accountMetadataRelative(account.accountType, account.id);
  const existing = store.readBytes(relative);
  let payload: Record<string, unknown> = {};
  if (existing) {
    try {
      payload = JSON.parse(existing.toString("utf8")) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  }

  const merged = {
    ...metadata,
    last_fetch_date:
      metadata.last_fetch_date ??
      (typeof payload.last_fetch_date === "string" ? payload.last_fetch_date : null),
  };

  store.writeBytes(relative, Buffer.from(JSON.stringify(merged, null, 2)));
}

export function refreshAccountMetadata(
  store: VaultStore,
  account: Account,
  financialYear: string | null,
  prepared: PreparedStatement[],
  parsedPeriods: readonly string[] = []
): MetadataAccountResult {
  const relative = accountMetadataRelative(account.accountType, account.id);
  const existing = store.readBytes(relative);
  let preservedLastFetch: string | null = null;
  let previous: StoredAccountMetadata | null = null;
  if (existing) {
    try {
      const payload = JSON.parse(existing.toString("utf8")) as StoredAccountMetadata;
      preservedLastFetch = payload.last_fetch_date ?? null;
      if (Array.isArray(payload.statements)) {
        previous = payload;
      }
    } catch {
      preservedLastFetch = null;
    }
  }

  let metadata = buildAccountMetadata(store, account, financialYear, prepared);
  metadata = mergePreservedTransactionsSync(metadata, previous);
  metadata = forceTransactionsUnsynced(metadata, parsedPeriods);
  if (preservedLastFetch) {
    metadata.last_fetch_date = preservedLastFetch;
  }
  writeAccountMetadata(store, account, metadata);

  return {
    statementCount: metadata.statement_count,
    preparedStatements: prepared,
  };
}
