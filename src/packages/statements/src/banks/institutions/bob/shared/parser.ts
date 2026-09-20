import { parseAmountString, parseDateString } from "@statements/banks/helpers/index";
import { normalizeBobPdfJsText } from "@statements/banks/institutions/bob/shared/helpers";
import {
  makeTransaction,
  type StatementParser,
  type Transaction,
} from "@statements/banks/parsers/common";

const TXN_WITH_REF =
  /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\S+)\s+(.+?)(?:\s+-?\d+)*\s+INR\s+[\d,]+\.\d{2}\s+([\d,]+\.\d{2})\s*(DR|CR)/gi;

/** BBPS and similar rows: date, label, INR, source amount, amount, DR/CR (no ref / reward columns). */
const TXN_DIRECT_INR =
  /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\S+)\s+INR\s+[\d,]+\.\d{2}\s+([\d,]+\.\d{2})\s*(DR|CR)/gi;

type PushBobRow = (
  txnDate: Date,
  description: string,
  amount: string,
  direction: string,
  refNo: string | null
) => void;

function collectBobRefRows(normalized: string, pushRow: PushBobRow): void {
  TXN_WITH_REF.lastIndex = 0;
  for (const match of normalized.matchAll(TXN_WITH_REF)) {
    const txnDate = parseDateString(match[1] ?? "");
    if (!txnDate) {
      continue;
    }
    const refNo = (match[2] ?? "").trim();
    if (refNo === "BBPS-PAYMENT") {
      continue;
    }
    const description = (match[3] ?? "").trim();
    const amount = parseAmountString((match[4] ?? "0").replace(/,/g, "")) ?? "0.00";
    const direction = (match[5] ?? "DR").toUpperCase();
    pushRow(txnDate, description, amount, direction, refNo);
  }
}

function collectBobDirectRows(normalized: string, pushRow: PushBobRow): void {
  TXN_DIRECT_INR.lastIndex = 0;
  for (const match of normalized.matchAll(TXN_DIRECT_INR)) {
    const txnDate = parseDateString(match[1] ?? "");
    if (!txnDate) {
      continue;
    }
    const description = (match[2] ?? "").trim();
    const amount = parseAmountString((match[3] ?? "0").replace(/,/g, "")) ?? "0.00";
    const direction = (match[4] ?? "DR").toUpperCase();
    pushRow(txnDate, description, amount, direction, null);
  }
}

function parseBobTransactions(text: string, sourceFile: string): Transaction[] {
  const rows: Transaction[] = [];
  const normalized = normalizeBobPdfJsText(text);
  const seen = new Set<string>();
  const pushRow: PushBobRow = (txnDate, description, amount, direction, refNo) => {
    const key = `${txnDate.toISOString()}:${description}:${amount}:${direction}:${refNo ?? ""}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    rows.push(makeTransaction(txnDate, description, amount, direction, sourceFile, refNo));
  };
  collectBobRefRows(normalized, pushRow);
  collectBobDirectRows(normalized, pushRow);
  return rows;
}

export const BobStatementParser: StatementParser = {
  parse(text, sourceFile) {
    return parseBobTransactions(text, sourceFile);
  },
};
