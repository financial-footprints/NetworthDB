import { createBankHandler } from "@statements/banks/handlers/base";
import { equationFirstAfter, singleAmountAfter } from "@statements/banks/helpers/index";
import { HdfcDefaultHandler } from "@statements/banks/institutions/hdfc/default/handler";
import {
  HDFC_DROP_SECTIONS,
  TATA_NEU_EXTRA_DROP,
} from "@statements/banks/institutions/hdfc/shared/config";
import {
  accountSummaryOpening,
  accountSummaryTotalDues,
  isHdfcV2,
  paymentDueTotalDues,
} from "@statements/banks/institutions/hdfc/shared/layouts";

export const HdfcTataNeuInfinityHandler = createBankHandler({
  mailSubjects: () => ["Your HDFC Bank - Tata Neu Infinity HDFC Bank Credit Card Statement"],
  trimEnd: () => ["Bonus NeuCoins Summary"],
  dropSections: () => [...HDFC_DROP_SECTIONS, ...TATA_NEU_EXTRA_DROP],
  yearDisplay: () => HdfcDefaultHandler.yearDisplay(),
  isAnnualStatement: () => false,
  getAnnualPeriod: () => null,
  getStatementDate: (text: string) => HdfcDefaultHandler.getStatementDate(text),
  getStatementPeriod: (text: string) => HdfcDefaultHandler.getStatementPeriod(text),
  getOpeningBalance(text) {
    if (isHdfcV2(text)) {
      return accountSummaryOpening(text);
    }
    return equationFirstAfter(text, "PREVIOUS STATEMENT DUES");
  },
  getClosingBalance(text) {
    if (isHdfcV2(text)) {
      return accountSummaryTotalDues(text) ?? paymentDueTotalDues(text);
    }
    return singleAmountAfter(text, "TOTAL AMOUNT DUE");
  },
});
