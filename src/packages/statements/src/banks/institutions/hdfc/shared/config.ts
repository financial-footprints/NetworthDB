import type { BankHandler } from "@statements/banks/handlers/base";
import {
  detectAnnualStatement,
  parseAnnualPeriod,
} from "@statements/banks/institutions/hdfc/shared/period";

export const HDFC_DROP_SECTIONS = [
  "Benefits on your card",
  "IMPORTANT INFORMATION",
  "Your Card Control Setting",
  "Purchase Indicator / Insights",
  "Offers on your card",
  "Important Information",
  "Useful Links",
  "To update your personal details, please write a letter to",
  "In case you wish to update the personal details",
  "Note : The  Available Credit Limit",
  "If the  Minimum Amount Due",
  "To Hotlist your Credit Card",
  "To Hotlist your credit card",
  "Credit Information Companies",
  "Making only the minimum payment every month",
  "Statement and Payment MITC",
  "with Credit Information Companies",
];

export const TATA_NEU_EXTRA_DROP = [
  "NeuCoins with Bank Opening NeuCoins",
  "Eligible for EMI",
  "CONVERT TO EMI",
];

export function hdfcNamedVariantShared(defaultHandler: BankHandler) {
  return {
    trimEnd: () => defaultHandler.trimEnd(),
    dropSections: () => defaultHandler.dropSections(),
    yearDisplay: () => defaultHandler.yearDisplay(),
    isAnnualStatement: detectAnnualStatement,
    getAnnualPeriod: parseAnnualPeriod,
    getStatementDate: (text: string) => defaultHandler.getStatementDate(text),
    getStatementPeriod: (text: string) => defaultHandler.getStatementPeriod(text),
    getOpeningBalance: (text: string) => defaultHandler.getOpeningBalance(text),
    getClosingBalance: (text: string) => defaultHandler.getClosingBalance(text),
  };
}
