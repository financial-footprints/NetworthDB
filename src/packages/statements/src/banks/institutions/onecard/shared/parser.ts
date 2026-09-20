import { parseAmountString, parseDateString } from "@statements/banks/helpers/index";
import { makeTransaction, type StatementParser } from "@statements/banks/parsers/common";
import { addDays, isAfter } from "date-fns";

const STOP_MARKER = "IMPORTANT INFORMATION";
const AMOUNT_ONLY = /^-?[\d,]+\.\d{2}$/;
const AMOUNT_HEADER = /^Amount\s*\(Rs\.\)/i;
const TXN_WITH_AMOUNT = /^([\d,]+\.\d{2})\s+(\d{1,2}\s+[A-Za-z]{3})\s+(.+)$/;
const TXN_NO_AMOUNT = /^(\d{1,2}\s+[A-Za-z]{3})\s+(.+)$/;
const DAY_MONTH_ONLY = /^\d{1,2}\s+[A-Za-z]{3}$/;
const POINTS_SUFFIX = /\s+[\d,]+\.\d{2}$/;
const CREDIT_DESC = /\b(?:repayments?|refunds?|paid\s+(?:with|via)(?:\s+\w+)*\s+points?)\b/i;
const STATEMENT_PERIOD =
  /One(?:Card| Credit Card) Statement\s*\((\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s*-\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s*\)/i;

function parseDecimal(value: string): string {
  return parseAmountString(value.replace(/,/g, "")) ?? "0.00";
}

function isAmountOnly(line: string): boolean {
  return AMOUNT_ONLY.test(line.trim());
}

function isAmountHeader(line: string): boolean {
  return AMOUNT_HEADER.test(line.trim());
}

function isTxnLine(line: string): boolean {
  const stripped = line.trim();
  if (!stripped) {
    return false;
  }
  return TXN_WITH_AMOUNT.test(stripped) || TXN_NO_AMOUNT.test(stripped);
}

function txnHasPrefixedAmount(line: string): boolean {
  return TXN_WITH_AMOUNT.test(line.trim());
}

function statementPeriodEnd(text: string): Date | null {
  const head = text.slice(0, Math.min(text.length, 2000));
  const match = STATEMENT_PERIOD.exec(head);
  if (!match?.[2]) {
    return null;
  }
  return parseDateString(match[2]);
}

function inferTxnYear(dayMonth: string, periodEnd: Date | null): number | null {
  if (!periodEnd) {
    return null;
  }
  const parsed = parseDateString(`${dayMonth} ${periodEnd.getFullYear()}`) ?? periodEnd;
  if (isAfter(parsed, addDays(periodEnd, 21))) {
    return periodEnd.getFullYear() - 1;
  }
  return periodEnd.getFullYear();
}

function stripRewardPoints(description: string): string {
  return description.replace(POINTS_SUFFIX, "").trim();
}

function isCredit(amount: string, description: string): boolean {
  const num = Number.parseFloat(amount);
  if (num < 0) {
    return true;
  }
  return CREDIT_DESC.test(description);
}

function buildTxnFromParts(
  dayMonth: string,
  description: string,
  amount: string,
  periodEnd: Date | null
): [Date, string, string, string] | null {
  const year = inferTxnYear(dayMonth, periodEnd);
  if (year == null) {
    return null;
  }
  const txnDate = parseDateString(`${dayMonth} ${year}`);
  if (!txnDate) {
    return null;
  }
  const direction = isCredit(amount, description) ? "CR" : "DR";
  return [txnDate, description, Math.abs(Number.parseFloat(amount)).toFixed(2), direction];
}

function parsePrefixedTxnLine(
  line: string,
  periodEnd: Date | null
): [Date, string, string, string] | null {
  const prefixed = TXN_WITH_AMOUNT.exec(line.trim());
  if (!prefixed) {
    return null;
  }
  const amount = parseDecimal(prefixed[1] ?? "0");
  const dayMonth = prefixed[2] ?? "";
  if (!DAY_MONTH_ONLY.test(dayMonth)) {
    return null;
  }
  const description = (prefixed[3] ?? "").trim();
  return buildTxnFromParts(dayMonth, description, amount, periodEnd);
}

function parseBareTxnLine(
  line: string,
  periodEnd: Date | null,
  pendingAmounts: string[]
): [Date, string, string, string] | null {
  const bare = TXN_NO_AMOUNT.exec(line.trim());
  if (!bare) {
    return null;
  }
  const dayMonth = bare[1] ?? "";
  if (!DAY_MONTH_ONLY.test(dayMonth)) {
    return null;
  }
  const descriptionRaw = (bare[2] ?? "").trim();
  if (pendingAmounts.length === 0) {
    return null;
  }
  const amount = pendingAmounts.shift() ?? "0.00";
  const description = stripRewardPoints(descriptionRaw);
  return buildTxnFromParts(dayMonth, description, amount, periodEnd);
}

function parseTxnLine(
  line: string,
  periodEnd: Date | null,
  pendingAmounts: string[]
): [Date, string, string, string] | null {
  return parsePrefixedTxnLine(line, periodEnd) ?? parseBareTxnLine(line, periodEnd, pendingAmounts);
}

function collectAmountCluster(lines: string[], start: number): [string[], number] {
  const amounts: string[] = [];
  let index = start;
  while (index < lines.length && isAmountOnly(lines[index] ?? "")) {
    amounts.push(parseDecimal((lines[index] ?? "").trim()));
    index += 1;
  }
  return [amounts, index];
}

function clusterApplies(lines: string[], index: number): boolean {
  let nextIndex = index;
  while (nextIndex < lines.length && (lines[nextIndex] ?? "").trim().length === 0) {
    nextIndex += 1;
  }
  if (nextIndex >= lines.length) {
    return false;
  }
  const nextLine = (lines[nextIndex] ?? "").trim();
  if (isAmountHeader(nextLine)) {
    return true;
  }
  return isTxnLine(nextLine) && !txnHasPrefixedAmount(nextLine);
}

function processOnecardLine(input: {
  lines: string[];
  index: number;
  periodEnd: Date | null;
  pendingAmounts: string[];
  sourceFile: string;
}): { rows: ReturnType<typeof makeTransaction>[]; nextIndex: number } {
  const { lines, index, periodEnd, pendingAmounts, sourceFile } = input;
  const line = lines[index] ?? "";
  if (line.includes(STOP_MARKER)) {
    return { rows: [], nextIndex: lines.length };
  }

  const stripped = line.trim();
  if (!stripped) {
    return { rows: [], nextIndex: index + 1 };
  }

  if (isAmountOnly(stripped)) {
    const [cluster, nextIndex] = collectAmountCluster(lines, index);
    if (clusterApplies(lines, nextIndex)) {
      pendingAmounts.push(...cluster);
    }
    return { rows: [], nextIndex };
  }

  if (isAmountHeader(stripped)) {
    return { rows: [], nextIndex: index + 1 };
  }

  if (!isTxnLine(stripped)) {
    return { rows: [], nextIndex: index + 1 };
  }

  const parsed = parseTxnLine(stripped, periodEnd, pendingAmounts);
  if (!parsed) {
    return { rows: [], nextIndex: index + 1 };
  }
  const [txnDate, description, amount, direction] = parsed;
  return {
    rows: [makeTransaction(txnDate, description, amount, direction, sourceFile, null)],
    nextIndex: index + 1,
  };
}

export const OnecardStatementParser: StatementParser = {
  parse(text, sourceFile) {
    const periodEnd = statementPeriodEnd(text);
    const lines = text.split("\n");
    const rows = [];
    const pendingAmounts: string[] = [];
    let index = 0;

    while (index < lines.length) {
      const { rows: parsedRows, nextIndex } = processOnecardLine({
        lines,
        index,
        periodEnd,
        pendingAmounts,
        sourceFile,
      });
      rows.push(...parsedRows);
      index = nextIndex;
    }

    return rows;
  },
};
