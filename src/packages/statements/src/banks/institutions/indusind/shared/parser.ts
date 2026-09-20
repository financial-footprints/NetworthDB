import {
  lineHasDrCrMarker,
  makeTransaction,
  parseDatedAmountLine,
  type StatementParser,
} from "@statements/banks/parsers/common";

export const IndusindStatementParser: StatementParser = {
  parse(text, sourceFile) {
    const rows = [];
    for (const line of text.split("\n")) {
      const stripped = line.trim();
      if (stripped.toUpperCase().startsWith("TOTAL")) {
        continue;
      }
      if (stripped.includes(" To ")) {
        continue;
      }
      if (!lineHasDrCrMarker(line)) {
        continue;
      }
      const parsed = parseDatedAmountLine(line);
      if (!parsed) {
        continue;
      }
      let [txnDate, description, amount, direction] = parsed;
      const parts = description.split(/\s+/).filter(Boolean);
      if (parts.length === 2 && parts[1]?.split("").every((c) => c >= "0" && c <= "9")) {
        description = parts[0] ?? description;
      }
      rows.push(makeTransaction(txnDate, description, amount, direction, sourceFile, null));
    }
    return rows;
  },
};
