import { CreditCardHandler, createBankHandler } from "@statements/banks/handlers/base";
import {
  firstNotNone,
  labelNextLineAmount,
  labelRangeEnd,
  labelRangePeriod,
  labelSingleDateEnd,
  summaryTableRow,
  topRangeEnd,
} from "@statements/banks/helpers/index";

export const FederalSignetHandler = createBankHandler({
  mailSubjects: () => ["Credit Card Statement"],
  trimEnd: () => ["GSTN of Federal Bank"],
  dropSections: () => [
    "The following illustration will indicate",
    "Organic Credit Cards",
    "Transaction dispute needs to be reported",
  ],
  getStatementDate: (text: string) =>
    firstNotNone([
      labelSingleDateEnd(text, "Statement Date"),
      labelRangeEnd(text, "Statement Period", " to "),
      topRangeEnd(text, " - ", 2000),
    ]),
  getStatementPeriod(text) {
    const [start, end] = labelRangePeriod(text, "Statement Period", " to ");
    if (start && end) {
      return [start, end];
    }
    return CreditCardHandler.defaultStatementPeriod(text, this.getStatementDate(text));
  },
  getOpeningBalance: (text: string) => summaryTableRow(text, "Payment Due Date", 1, "opening"),
  getClosingBalance: (text: string) =>
    firstNotNone([
      labelNextLineAmount(text, "Total Amount Due (in Rs.)"),
      summaryTableRow(text, "Payment Due Date", 1, "closing"),
    ]),
});
