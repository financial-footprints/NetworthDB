import { CreditCardHandler } from "@statements/banks/handlers/base";
import {
  dateAfterLabel,
  exactLabelNextLineAmount,
  labelRangeEnd,
  labelRangePeriod,
  summaryTableColumn,
} from "@statements/banks/helpers/index";

function iciciStatementSummaryWindow(text: string): string {
  const start = text.search(/STATEMENT\s+SUMMARY/i);
  if (start === -1) {
    return text;
  }
  const slice = text.slice(start);
  const stop = slice.search(
    /SPENDS\s+OVERVIEW|Interest will be charged if your|Minimum Amount due/i
  );
  return stop === -1 ? slice : slice.slice(0, stop);
}

export const ICICI_DROP_SECTIONS = [
  "For exclusive",
  "offers, visit",
  "IMPORTANT MESSAGES",
  "Download the iMobile Pay app",
  "CREDIT CARD STATEMENT",
  "GREAT    OFFERS    ON   YOUR   CARD",
  "IMPORTANT     INFORMATION      ON  YOUR   CREDIT   CARD",
  "ICICl Bank Rewards",
  "SPENDS OVERVIEW",
  "# International Spends",
  "Others-100%",
  "www.icicibank.com/offers",
  "For any query, you may write to us on customer.care",
  "T&C apply",
];

const STATEMENT_PERIOD_LABELS = ["Statement period :", "Statement Period:", "Statement Period"];

function iciciStatementDate(text: string): Date | null {
  const fromLabel = dateAfterLabel(text, "STATEMENT DATE");
  if (fromLabel) {
    return fromLabel;
  }
  for (const label of STATEMENT_PERIOD_LABELS) {
    const end = labelRangeEnd(text, label, " to ");
    if (end) {
      return end;
    }
  }
  return null;
}

function iciciStatementPeriod(
  text: string,
  statementDate: Date | null
): [Date | null, Date | null] {
  for (const label of STATEMENT_PERIOD_LABELS) {
    const [start, end] = labelRangePeriod(text, label, " to ");
    if (start && end) {
      return [start, end];
    }
  }
  return CreditCardHandler.defaultStatementPeriod(text, statementDate);
}

export const iciciSharedHandlerConfig = {
  yearDisplay: () => "fiscal_year" as const,
  trimEnd: () => ["MOST IMPORTANT TERMS AND CONDITIONS (MITC)"],
  dropSections: () => ICICI_DROP_SECTIONS,
  getStatementDate: iciciStatementDate,
  getStatementPeriod(text: string) {
    return iciciStatementPeriod(text, iciciStatementDate(text));
  },
  getOpeningBalance: (text: string) =>
    summaryTableColumn(text, "Previous Balance", "Previous Balance", 300),
  getClosingBalance: (text: string) =>
    exactLabelNextLineAmount(iciciStatementSummaryWindow(text), "Total Amount due"),
};
