import { parseAmountString, parseDateString } from "@statements/banks/helpers/index";
import { makeTransaction, type StatementParser } from "@statements/banks/parsers/common";

const ANNUAL_LINE = /^(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+(DR|CR)\b/i;
const MONTHLY_LINE =
  /^\s*(\d{1,2}\/\d{1,2}\/\d{4})(?:\s+\d{1,2}:\d{2}:\d{2})?\s+(.+?)\s+([\d,]+\.\d{2})\s*(Cr|CR|Dr|DR)?\s*$/i;

function directionFromSuffix(raw?: string | null): string {
  if (raw?.toUpperCase().startsWith("C")) {
    return "CR";
  }
  return "DR";
}

function txnKey(txnDate: Date, description: string, amount: string, direction: string): string {
  return `${txnDate.toISOString()}|${description}|${amount}|${direction}`;
}

type ParsedTxn = {
  txnDate: Date;
  description: string;
  amount: string;
  direction: string;
};

function parseAnnualMatch(caps: RegExpMatchArray, seen: Set<string>): ParsedTxn | null {
  const txnDate = parseDateString(caps[1] ?? "");
  if (!txnDate) {
    return null;
  }
  const description = (caps[2] ?? "").trim();
  const amount = parseAmountString((caps[3] ?? "0").replace(/,/g, "")) ?? "0.00";
  const direction = (caps[4] ?? "DR").toUpperCase();
  const key = txnKey(txnDate, description, amount, direction);
  if (seen.has(key)) {
    return null;
  }
  seen.add(key);
  return { txnDate, description, amount, direction };
}

function parseMonthlyMatch(caps: RegExpMatchArray, seen: Set<string>): ParsedTxn | null {
  const txnDate = parseDateString(caps[1] ?? "");
  if (!txnDate) {
    return null;
  }
  const description = (caps[2] ?? "").trim();
  if (!description) {
    return null;
  }
  const amount = parseAmountString((caps[3] ?? "0").replace(/,/g, "")) ?? "0.00";
  const direction = directionFromSuffix(caps[4]);
  const key = txnKey(txnDate, description, amount, direction);
  if (seen.has(key)) {
    return null;
  }
  seen.add(key);
  return { txnDate, description, amount, direction };
}

function parseAnnualMatches(text: string, seen: Set<string>): ParsedTxn[] {
  const rows: ParsedTxn[] = [];
  for (const caps of text.matchAll(new RegExp(ANNUAL_LINE.source, "gim"))) {
    const parsed = parseAnnualMatch(caps, seen);
    if (parsed) {
      rows.push(parsed);
    }
  }
  return rows;
}

function parseMonthlyMatches(text: string, seen: Set<string>): ParsedTxn[] {
  const rows: ParsedTxn[] = [];
  for (const caps of text.matchAll(new RegExp(MONTHLY_LINE.source, "gim"))) {
    const parsed = parseMonthlyMatch(caps, seen);
    if (parsed) {
      rows.push(parsed);
    }
  }
  return rows;
}

export const HdfcStatementParser: StatementParser = {
  parse(text, sourceFile) {
    const seen = new Set<string>();
    const parsed = [...parseAnnualMatches(text, seen), ...parseMonthlyMatches(text, seen)];
    return parsed.map(({ txnDate, description, amount, direction }) =>
      makeTransaction(txnDate, description, amount, direction, sourceFile, null)
    );
  },
};
