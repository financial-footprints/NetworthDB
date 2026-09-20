import { approximatePeriodIfNeeded } from "@statements/banks/institutions/hdfc/shared/layouts";
import {
  contextRangeStatementDate,
  contextRangeStatementPeriod,
} from "@statements/banks/shared/mixins";
import { parseMonthYearToken } from "@statements/period/statement-period";
import { lastDayOfMonth } from "date-fns";

const ANNUAL_PERIOD_PATTERN = /period from\s+([A-Z]+-\d{2,4})\s+to\s+([A-Z]+-\d{2,4})/i;

export function detectAnnualStatement(text: string): boolean {
  const lowered = text.toLowerCase();
  if (
    lowered.includes("year end statement") &&
    lowered.includes("account summary for the period from")
  ) {
    return true;
  }
  if (!ANNUAL_PERIOD_PATTERN.test(text)) {
    return false;
  }
  return lowered.includes("year end statement") || lowered.includes("account summary");
}

export function parseAnnualPeriod(text: string): [Date, Date] | null {
  const match = ANNUAL_PERIOD_PATTERN.exec(text);
  if (!match) {
    return null;
  }

  const startToken = parseMonthYearToken(match[1] ?? "");
  const endToken = parseMonthYearToken(match[2] ?? "");
  if (!startToken || !endToken) {
    return null;
  }

  const { y: startYear, m: startMonth } = startToken;
  const { y: endYear, m: endMonth } = endToken;
  const endDay = lastDayOfMonth(new Date(endYear, endMonth - 1, 1)).getDate();
  return [new Date(startYear, startMonth - 1, 1), new Date(endYear, endMonth - 1, endDay)];
}

export function resolveHdfcStatementPeriod(
  handler: { getStatementDate(text: string): Date | null },
  text: string
): [Date | null, Date | null] {
  if (detectAnnualStatement(text)) {
    const annual = parseAnnualPeriod(text);
    if (annual) {
      return annual;
    }
  }

  let [start, end] = contextRangeStatementPeriod(text, "Billing Period", " - ");
  [start, end] = approximatePeriodIfNeeded(start, end);
  if (!start || !end) {
    const statementDate = handler.getStatementDate(text);
    if (statementDate) {
      return approximatePeriodIfNeeded(start, statementDate);
    }
  }
  return [start, end];
}

export { contextRangeStatementDate };
