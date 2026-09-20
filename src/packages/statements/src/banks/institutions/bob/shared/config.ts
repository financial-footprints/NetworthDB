import {
  firstNotNone,
  parseAmountString,
  summaryTableColumn,
  summaryTableRow,
} from "@statements/banks/helpers/index";
import { cleanBobStatementText } from "@statements/banks/institutions/bob/shared/helpers";
import { bobStatementDate, bobStatementPeriod } from "@statements/banks/shared/mixins";

const GLANCE_BALANCES =
  /This Month s Statement At A Glance[\s\S]*?Closing Balance\s+(-?[\d,]+\.\d{2})\s+[\d,.-]+\s+[\d,.-]+\s+(-?[\d,]+\.\d{2})/i;

/** Split-header Account Summary: Purchases/Debits row then four amount columns. */
const ACCOUNT_SUMMARY_FOUR_COLUMN =
  /Purchases\/Debits[^\n]*\n\s*(-?[\d,]+\.\d{2}|\.00)\s+(-?[\d,]+\.\d{2}|\.00)\s+(-?[\d,]+\.\d{2}|\.00)\s+(-?[\d,]+\.\d{2})/i;

function accountSummaryOpeningBalance(text: string): string | null {
  const match = ACCOUNT_SUMMARY_FOUR_COLUMN.exec(text);
  if (!match) {
    return null;
  }
  return parseAmountString((match[1] ?? "").replace(/,/g, ""));
}

function accountSummaryClosingBalance(text: string): string | null {
  const match = ACCOUNT_SUMMARY_FOUR_COLUMN.exec(text);
  if (!match) {
    return null;
  }
  return parseAmountString((match[4] ?? "").replace(/,/g, ""));
}

function glanceOpeningBalance(text: string): string | null {
  const match = GLANCE_BALANCES.exec(text);
  if (!match) {
    return null;
  }
  return parseAmountString((match[1] ?? "").replace(/,/g, ""));
}

function glanceClosingBalance(text: string): string | null {
  const match = GLANCE_BALANCES.exec(text);
  if (!match) {
    return null;
  }
  return parseAmountString((match[2] ?? "").replace(/,/g, ""));
}

export const bobSharedHandlerConfig = {
  trimEnd: () => ["Reward Summary at Card Level", "Page 1 of"],
  cleanText(raw: string) {
    return cleanBobStatementText(raw, []);
  },
  getStatementDate: bobStatementDate,
  getStatementPeriod: bobStatementPeriod,
  getOpeningBalance: (text: string) =>
    firstNotNone([
      accountSummaryOpeningBalance(text),
      glanceOpeningBalance(text),
      summaryTableColumn(text, "Account Summary", "Opening Balance", 2000),
      summaryTableColumn(text, "This Month's Statement At A Glance", "Opening Balance", 2000),
      summaryTableColumn(text, "This Month s Statement At A Glance", "Opening Balance", 2000),
      summaryTableRow(text, "GST No:", 2, "opening"),
      summaryTableRow(text, "GST No:", 1, "opening"),
    ]),
  getClosingBalance: (text: string) =>
    firstNotNone([
      accountSummaryClosingBalance(text),
      glanceClosingBalance(text),
      summaryTableColumn(text, "Account Summary", "Closing Balance", 2000),
      summaryTableColumn(text, "This Month's Statement At A Glance", "Closing Balance", 2000),
      summaryTableColumn(text, "This Month s Statement At A Glance", "Closing Balance", 2000),
      summaryTableRow(text, "GST No:", 2, "closing"),
      summaryTableRow(text, "GST No:", 1, "closing"),
    ]),
};

export const BOB_EASY_DROP = [
  "Please register your Mobile No. & E-Mail ID",
  "Please register your Mobile No. and Email ID",
  "Please register your Mobile Number & Email ID",
  "Loan Summary",
  "GO DIGITAL to SELF-SERVICE",
  "YOUR CONVENIENCE IS OUR PRIORITY",
  "Did You Know",
  "SCHEDULE OF CHARGES",
  "IMPORTANT",
  "CIBIL Information",
  "Billing Dispute Resolution",
  "For T&C & details on Fee/charges",
  "Important Security Update for Your BOBCARD",
  "via the BOBCARD mobile app or portal",
  "Clickheretoknowmore",
];
