import {
  dateAfterLabel,
  exactLabelNextLineAmount,
  firstNotNone,
  labelNextLineAmount,
  totalOutstandingSectionAmount,
} from "@statements/banks/helpers/index";
import {
  contextRangeStatementDate,
  contextRangeStatementPeriod,
} from "@statements/banks/shared/mixins";

function indusindAccountSummaryWindow(text: string): string {
  const end = text.search(
    /ACCOUNTSUMMARY|Account\s*SUMMARY|Statement Period|Purchases\s*&\s*Cash Transactions/i
  );
  return end === -1 ? text.slice(0, 2500) : text.slice(0, end);
}

export const indusindSharedHandlerConfig = {
  trimEnd: () => ["Rewards Opening Balance", "Rewards OpeningBalance"],
  dropSections: () => [
    "IMPORTANT MESSAGES:",
    "IMPORTANTMESSAGES:",
    "PROMOTIONAL MESSAGES:",
    "PROMOTIONALMESSAGES:",
    "MARKETING MESSAGE",
    "MARKETINGMESSAGE",
    "NOTE: *Total of points redeemed",
    "With IndusAlerts",
    "Secure your IndusInd Bank Credit Card on-the-go",
    "HOW TO MAKE PAYMENTS",
    "FEES & CHARGES",
    "CREDIT AND CASH WITHDRAWAL LIMITS",
    "Pleasedrawyourcheque",
    "Closest IndusInd Bank ATM Drop Box",
    "Manage your Card with instant Card blocking",
  ],
  getStatementDate: (text: string) =>
    contextRangeStatementDate(text, "Statement Period", " To ") ??
    dateAfterLabel(text, "Statement Date"),
  getStatementPeriod: (text: string) =>
    contextRangeStatementPeriod(text, "Statement Period", " To "),
  getOpeningBalance: (text: string) =>
    exactLabelNextLineAmount(indusindAccountSummaryWindow(text), "Previous Balance"),
  getClosingBalance: (text: string) =>
    firstNotNone([
      totalOutstandingSectionAmount(text),
      labelNextLineAmount(text, "Total Amount Due"),
    ]),
};
