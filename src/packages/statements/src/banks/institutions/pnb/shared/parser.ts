import { parseAmountString, parseDateString } from "@statements/banks/helpers/index";
import { makeTransaction, type StatementParser } from "@statements/banks/parsers/common";

const LINE = /^(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(.+)$/;
const AMOUNT_TAIL = /([\d,]+\.\d{2})\s*(Cr|Dr|CR|DR)?\s*$/i;

function parsePnbLine(raw: string, sourceFile: string): ReturnType<typeof makeTransaction> | null {
  const stripped = raw.trim();
  if (stripped.toUpperCase().startsWith("TOTAL")) {
    return null;
  }
  const caps = LINE.exec(stripped);
  if (!caps) {
    return null;
  }
  const txnDate = parseDateString(caps[1] ?? "");
  if (!txnDate) {
    return null;
  }
  const rest = (caps[3] ?? "").trim();
  const amtCaps = AMOUNT_TAIL.exec(rest);
  if (!amtCaps || amtCaps.index == null) {
    return null;
  }
  const amount = parseAmountString((amtCaps[1] ?? "0").replace(/,/g, "")) ?? "0.00";
  const rawDir = amtCaps[2];
  const direction = rawDir?.toUpperCase().startsWith("C") ? "CR" : "DR";
  const description = rest.slice(0, amtCaps.index).trim();
  if (!description) {
    return null;
  }
  return makeTransaction(txnDate, description, amount, direction, sourceFile, null);
}

export const PnbStatementParser: StatementParser = {
  parse(text, sourceFile) {
    const rows = [];
    for (const raw of text.split("\n")) {
      const row = parsePnbLine(raw, sourceFile);
      if (row) {
        rows.push(row);
      }
    }
    return rows;
  },
};
