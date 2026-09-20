import { parseAmountString, parseDateString } from "@statements/banks/helpers/index";
import {
  parseDatedAmountLine,
  parseDdMonRsDrCrLine,
  parseStopAtEndLines,
  type StatementParser,
} from "@statements/banks/parsers/common";

const DMY_HYPHEN_DR_CR_LINE =
  /^\s*(\d{1,2}-\d{1,2}-\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(Dr|Cr)\s*$/i;

function parseDmyHyphenDrCrLine(line: string): [Date, string, string, string] | null {
  const caps = DMY_HYPHEN_DR_CR_LINE.exec(line.trim());
  if (!caps) {
    return null;
  }
  const txnDate = parseDateString(caps[1] ?? "");
  if (!txnDate) {
    return null;
  }
  const description = (caps[2] ?? "").trim();
  if (!description) {
    return null;
  }
  const amount = parseAmountString((caps[3] ?? "0").replace(/,/g, "")) ?? "0.00";
  const direction = (caps[4] ?? "").toUpperCase().startsWith("C") ? "CR" : "DR";
  return [txnDate, description, amount, direction];
}

export const FederalDefaultParser: StatementParser = {
  parse(text, sourceFile) {
    return parseStopAtEndLines(text, parseDatedAmountLine, sourceFile, "End of Transactions");
  },
};

export const FederalSignetParser: StatementParser = {
  parse(text, sourceFile) {
    return parseStopAtEndLines(text, parseDmyHyphenDrCrLine, sourceFile, "End of Transactions");
  },
};

export const FederalEdgeParser: StatementParser = {
  parse(text, sourceFile) {
    return parseStopAtEndLines(text, parseDdMonRsDrCrLine, sourceFile, "End of Transactions");
  },
};
