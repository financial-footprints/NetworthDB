import { createBankHandler } from "@statements/banks/handlers/base";
import {
  dateAfterLabel,
  firstNotNone,
  labelSingleDateEnd,
  summaryTableColumn,
  summaryTableRow,
} from "@statements/banks/helpers/index";
import { HDFC_DROP_SECTIONS } from "@statements/banks/institutions/hdfc/shared/config";
import {
  accountSummaryOpening,
  accountSummaryTotalDues,
  isHdfcV2,
  paymentDueTotalDues,
} from "@statements/banks/institutions/hdfc/shared/layouts";
import {
  contextRangeStatementDate,
  detectAnnualStatement,
  parseAnnualPeriod,
  resolveHdfcStatementPeriod,
} from "@statements/banks/institutions/hdfc/shared/period";

export const HdfcDefaultHandler = createBankHandler({
  mailSubjects: () => ["HDFC Bank Credit Card Statement"],
  trimEnd: () => ["Reward Points Summary"],
  dropSections: () => HDFC_DROP_SECTIONS,
  yearDisplay: () => "fiscal_year",
  isAnnualStatement: detectAnnualStatement,
  getAnnualPeriod: parseAnnualPeriod,
  getStatementDate(text) {
    if (detectAnnualStatement(text)) {
      const annual = parseAnnualPeriod(text);
      if (annual) {
        return annual[1];
      }
    }
    return firstNotNone([
      labelSingleDateEnd(text, "Statement Date"),
      dateAfterLabel(text, "Statement Date"),
      dateAfterLabel(text, "Address"),
      contextRangeStatementDate(text, "Billing Period", " - "),
    ]);
  },
  getStatementPeriod(text) {
    return resolveHdfcStatementPeriod(this, text);
  },
  getOpeningBalance(text) {
    if (detectAnnualStatement(text)) {
      return null;
    }
    if (isHdfcV2(text)) {
      return accountSummaryOpening(text);
    }
    return firstNotNone([
      summaryTableColumn(text, "Account Summary", "Opening Balance", 2000),
      summaryTableRow(text, "Account Summary", 1, "opening"),
    ]);
  },
  getClosingBalance(text) {
    if (detectAnnualStatement(text)) {
      return null;
    }
    if (isHdfcV2(text)) {
      return accountSummaryTotalDues(text) ?? paymentDueTotalDues(text);
    }
    return firstNotNone([
      summaryTableColumn(text, "Account Summary", "Total Dues", 2000),
      summaryTableRow(text, "Account Summary", 1, "closing"),
    ]);
  },
});
