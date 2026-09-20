import type { StatementParser } from "@statements/banks/parsers/common";
import { parseDdMonRsDrCrLine, parseStopAtEndLines } from "@statements/banks/parsers/common";

export const CsbStatementParser: StatementParser = {
  parse(text, sourceFile) {
    return parseStopAtEndLines(text, parseDdMonRsDrCrLine, sourceFile, "End of Transactions");
  },
};
