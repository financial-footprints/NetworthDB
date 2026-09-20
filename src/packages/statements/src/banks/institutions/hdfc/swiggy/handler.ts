import { createBankHandler } from "@statements/banks/handlers/base";
import { HdfcDefaultHandler } from "@statements/banks/institutions/hdfc/default/handler";
import {
  swiggyClosingBalance,
  swiggyOpeningBalance,
} from "@statements/banks/institutions/hdfc/shared/layouts";
import { resolveHdfcStatementPeriod } from "@statements/banks/institutions/hdfc/shared/period";

export const HdfcSwiggyHandler = createBankHandler({
  mailSubjects: () => ["Swiggy HDFC Bank Credit Card Statement"],
  trimEnd: () => HdfcDefaultHandler.trimEnd(),
  dropSections: () => HdfcDefaultHandler.dropSections(),
  yearDisplay: () => HdfcDefaultHandler.yearDisplay(),
  isAnnualStatement: () => false,
  getAnnualPeriod: () => null,
  getStatementDate: (text) => HdfcDefaultHandler.getStatementDate(text),
  getStatementPeriod: (text) => resolveHdfcStatementPeriod(HdfcDefaultHandler, text),
  getOpeningBalance: swiggyOpeningBalance,
  getClosingBalance: swiggyClosingBalance,
});
