import type { PipelineRun } from "@ndb/core";
import type { Transaction } from "@statements/banks/parsers/common";
import { getParser } from "@statements/banks/parsers/index";
import type { StatementsEngineConfig } from "@statements/config/runtime";
import { openVaultStore } from "@statements/config/runtime";
import { raiseIfCancelled } from "@statements/engine/errors";
import { parseMonthPeriod } from "@statements/period/statement-period";
import type {
  ParseAccountResult,
  PreparedStatement,
} from "@statements/pipeline/stages/cleanup/models";
import { markTransactionsUnsyncedForPeriods } from "@statements/pipeline/stages/metadata/transactions-sync";
import { writeTransactionsCsv } from "@statements/pipeline/stages/parse/write-csv";
import {
  listMonthlyPdfRelatives,
  listMonthlyStatementCsvRelatives,
  statementCsvPeriodStem,
  statementTxtRelative,
  transactionsCsvRelative,
} from "@statements/storage/vault/path";
import type { VaultStore } from "@statements/storage/vault/store";

type StatementParser = ReturnType<typeof getParser>;

function selectTransactionRows(
  parser: StatementParser,
  period: string,
  pdfText: string | null,
  csvText: string | null
): Transaction[] {
  if (pdfText !== null) {
    const pdfRows = parser.parse(pdfText, `${period}.pdf`);
    if (pdfRows.length > 0) {
      return pdfRows;
    }
  }
  if (csvText !== null) {
    return parser.parse(csvText, `${period}.csv`);
  }
  return [];
}

function writePeriodRows(
  store: VaultStore,
  account: PipelineRun["account"],
  period: string,
  rows: Transaction[],
  parsedPeriods: Set<string>,
  rowCountByPeriod: Map<string, number>
): number {
  const csvRelative = transactionsCsvRelative(account.accountType, account.id, period);
  writeTransactionsCsv(store, csvRelative, rows);
  parsedPeriods.add(period);
  rowCountByPeriod.set(period, rows.length);
  return rows.length;
}

function parsePreparedStatements(
  prepared: PreparedStatement[],
  store: VaultStore,
  parser: StatementParser,
  account: PipelineRun["account"],
  parsedPeriods: Set<string>,
  rowCountByPeriod: Map<string, number>
): number {
  const pdfText = new Map<string, string>();
  const csvText = new Map<string, string>();
  for (const stmt of prepared) {
    if (stmt.pdfBytes) {
      pdfText.set(stmt.period, stmt.cleanedText);
    }
    if (stmt.sourceCsv) {
      csvText.set(stmt.period, stmt.cleanedText);
    }
  }

  const periods = new Set([...pdfText.keys(), ...csvText.keys()]);
  let rowCount = 0;
  for (const period of periods) {
    const rows = selectTransactionRows(
      parser,
      period,
      pdfText.get(period) ?? null,
      csvText.get(period) ?? null
    );
    rowCount += writePeriodRows(store, account, period, rows, parsedPeriods, rowCountByPeriod);
  }
  return rowCount;
}

function parseVaultPdfFallbacks(
  store: VaultStore,
  parser: StatementParser,
  account: PipelineRun["account"],
  financialYear: string | null,
  parsedPeriods: Set<string>,
  rowCountByPeriod: Map<string, number>
): number {
  let rowCount = 0;
  for (const pdfRelative of listMonthlyPdfRelatives(
    store,
    account.accountType,
    account.id,
    financialYear
  )) {
    const stem =
      pdfRelative
        .split("/")
        .pop()
        ?.replace(/\.pdf$/i, "") ?? "";
    if (!parseMonthPeriod(stem)) {
      continue;
    }
    if (rowCountByPeriod.has(stem)) {
      continue;
    }

    const txtRelative = statementTxtRelative(account.accountType, account.id, stem);
    const bytes = store.readBytes(txtRelative);
    if (!bytes) {
      throw new Error(`missing txt: ${txtRelative}`);
    }

    const rows = selectTransactionRows(parser, stem, bytes.toString("utf8"), null);
    rowCount += writePeriodRows(store, account, stem, rows, parsedPeriods, rowCountByPeriod);
  }
  return rowCount;
}

function parseVaultCsvFallbacks(
  store: VaultStore,
  parser: StatementParser,
  account: PipelineRun["account"],
  financialYear: string | null,
  parsedPeriods: Set<string>,
  rowCountByPeriod: Map<string, number>
): number {
  let rowCount = 0;
  for (const csvRelative of listMonthlyStatementCsvRelatives(
    store,
    account.accountType,
    account.id,
    financialYear
  )) {
    const stem = statementCsvPeriodStem(csvRelative);
    if (!stem) {
      continue;
    }
    if ((rowCountByPeriod.get(stem) ?? 0) > 0) {
      continue;
    }

    const bytes = store.readBytes(csvRelative);
    if (!bytes) {
      continue;
    }

    const rows = selectTransactionRows(parser, stem, null, bytes.toString("utf8"));
    rowCount += writePeriodRows(store, account, stem, rows, parsedPeriods, rowCountByPeriod);
  }
  return rowCount;
}

export async function runParse(
  pipeline: PipelineRun,
  config: StatementsEngineConfig,
  prepared: PreparedStatement[],
  shouldCancel?: () => boolean
): Promise<ParseAccountResult> {
  raiseIfCancelled(shouldCancel);

  const store = openVaultStore(config, pipeline.userId, pipeline.dataKey);
  const account = pipeline.account;
  const parser = getParser(account.bank, account.variant ?? undefined);

  const parsedPeriods = new Set<string>();
  const rowCountByPeriod = new Map<string, number>();
  let rowCount = parsePreparedStatements(
    prepared,
    store,
    parser,
    account,
    parsedPeriods,
    rowCountByPeriod
  );
  rowCount += parseVaultPdfFallbacks(
    store,
    parser,
    account,
    pipeline.financialYear,
    parsedPeriods,
    rowCountByPeriod
  );
  rowCount += parseVaultCsvFallbacks(
    store,
    parser,
    account,
    pipeline.financialYear,
    parsedPeriods,
    rowCountByPeriod
  );

  if (parsedPeriods.size > 0) {
    markTransactionsUnsyncedForPeriods(store, account, [...parsedPeriods]);
  }

  return {
    rowCount,
    parsedPeriods: [...parsedPeriods],
  };
}
