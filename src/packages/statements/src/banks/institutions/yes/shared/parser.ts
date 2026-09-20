import {
  makeTransaction,
  parseDatedAmountLine,
  type StatementParser,
} from "@statements/banks/parsers/common";

export const YesStatementParser: StatementParser = {
  parse(text, sourceFile) {
    const rows = [];
    for (const line of text.split("\n")) {
      if (line.toLowerCase().includes("nil transaction")) {
        continue;
      }
      const parsed = parseDatedAmountLine(line);
      if (!parsed) {
        continue;
      }
      const [txnDate, description, amount, direction] = parsed;
      rows.push(makeTransaction(txnDate, description, amount, direction, sourceFile, null));
    }
    return rows;
  },
};
