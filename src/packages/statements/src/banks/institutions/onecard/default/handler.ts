import { CreditCardHandler, createBankHandler } from "@statements/banks/handlers/base";
import {
  amountsWithPositions,
  dateAfterLabel,
  exactLabelNextLineAmount,
  lineRemainderAfterLabel,
  parseDateString,
  topRangePeriod,
} from "@statements/banks/helpers/index";

const STATEMENT_PERIOD =
  /One(?:Card| Credit Card) Statement\s*\((\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s*-\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s*\)/i;

export const OnecardDefaultHandler = createBankHandler({
  mailSubjects: () => ["OneCard Statement", "One Credit Card Statement"],
  trimEnd: () => ["IMPORTANT INFORMATION"],
  getStatementDate: (text) => dateAfterLabel(text, "Statement Date"),
  getStatementPeriod(text) {
    const head = text.slice(0, Math.min(text.length, 2000));
    const match = STATEMENT_PERIOD.exec(head);
    if (match) {
      const periodStart = parseDateString(match[1] ?? "");
      const periodEnd = parseDateString(match[2] ?? "");
      if (periodStart && periodEnd) {
        return [periodStart, periodEnd];
      }
    }

    const [start, end] = topRangePeriod(text, " - ");
    if (start && end) {
      return [start, end];
    }

    const statementDate = this.getStatementDate(text);
    return CreditCardHandler.defaultStatementPeriod(text, statementDate);
  },
  getOpeningBalance(text) {
    const remainder = lineRemainderAfterLabel(text, "Opening Balance");
    if (!remainder) {
      return null;
    }
    const currencyAmounts = amountsWithPositions(remainder, true);
    if (currencyAmounts.at(-1)) {
      return currencyAmounts.at(-1)?.amount ?? null;
    }
    return amountsWithPositions(remainder, false).at(-1)?.amount ?? null;
  },
  getClosingBalance(text) {
    const summaryEnd = text.search(/STATEMENT ILLUSTRATION|TRANSACTION HISTORY/i);
    const window = summaryEnd === -1 ? text : text.slice(0, summaryEnd);
    return exactLabelNextLineAmount(window, "Total Amount Due");
  },
});
