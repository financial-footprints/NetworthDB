import { parseAmountString, parseDateString } from "@statements/banks/helpers/index";
import { makeTransaction, type StatementParser } from "@statements/banks/parsers/common";

const DATE_PREFIX = /^(\d{1,2}\/(?:\d{1,2}|[A-Za-z]{3})\/\d{2,4}|\d{1,2}\s+[A-Za-z]{3}\s+\d{2})\s+/;
const DR_CR_SUFFIX = /\s+(DR|CR)\s*$/i;
const CR_SUFFIX = /\s+CR\s*$/i;
const FX_TAIL = /\s+USD\s+[\d,]+\.\d{2}\s*$/i;
const DECIMAL_AMOUNT = /[\d,]+\.\d{2}/g;

function parseTransactionLine(line: string): [Date, string, string, string] | null {
  const stripped = line.trim();
  if (!stripped) {
    return null;
  }
  const caps = DATE_PREFIX.exec(stripped);
  if (!caps) {
    return null;
  }
  const txnDate = parseDateString(caps[1] ?? "");
  if (!txnDate) {
    return null;
  }

  let rest = stripped.slice(caps[0]?.length ?? 0).trim();
  let direction = "DR";

  const drCrMatch = DR_CR_SUFFIX.exec(rest);
  if (drCrMatch && drCrMatch.index != null) {
    direction = (drCrMatch[1] ?? "DR").toUpperCase();
    rest = rest.slice(0, drCrMatch.index).trim();
  } else if (CR_SUFFIX.test(rest)) {
    direction = "CR";
    rest = rest.replace(CR_SUFFIX, "").trim();
  }

  const amountMatches = [...rest.matchAll(DECIMAL_AMOUNT)];
  if (amountMatches.length === 0) {
    return null;
  }
  const last = amountMatches.at(-1);
  if (!last || last.index == null) {
    return null;
  }

  const amount = parseAmountString((last[0] ?? "0").replace(/,/g, "")) ?? "0.00";
  const description = rest.slice(0, last.index).trim().replace(FX_TAIL, "").trim();
  if (!description) {
    return null;
  }

  return [txnDate, description, amount, direction];
}

export const IdfcWowStatementParser: StatementParser = {
  parse(text, sourceFile) {
    const rows = [];
    for (const line of text.split("\n")) {
      const parsed = parseTransactionLine(line);
      if (!parsed) {
        continue;
      }
      const [txnDate, description, amount, direction] = parsed;
      rows.push(makeTransaction(txnDate, description, amount, direction, sourceFile, null));
    }
    return rows;
  },
};
