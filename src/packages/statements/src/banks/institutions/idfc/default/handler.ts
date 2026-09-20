import { CreditCardHandler, createBankHandler } from "@statements/banks/handlers/base";
import { labelSingleAmount, summaryTableColumn } from "@statements/banks/helpers/index";

export const IdfcDefaultHandler = createBankHandler({
  mailSubjects: () => ["Credit Card Statement"],
  getStatementDate: () => null,
  getStatementPeriod(text) {
    return CreditCardHandler.defaultStatementPeriod(text, this.getStatementDate(text));
  },
  getOpeningBalance: (text: string) =>
    summaryTableColumn(text, "STATEMENT SUMMARY", "Opening Balance", 2000),
  getClosingBalance: (text: string) => labelSingleAmount(text, "Total Amount Due"),
});
