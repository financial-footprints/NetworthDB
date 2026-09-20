import { amountsWithPositions, findLabel, parseDateString } from "@statements/banks/helpers/index";
import { approxStartFromEnd } from "@statements/period/billing-period";
import { format, parseISO } from "date-fns";

const STATEMENT_DATE_SPLIT = /Statement\s*\n\s*Date\s*:/i;
const STACKED_OPENING_BALANCE = /Account Summary[\s\S]{0,240}?Opening\s*\n\s*Balance\b/i;

export function isHdfcV2(text: string): boolean {
  if (text.toUpperCase().includes("DUPLICATE STATEMENT")) {
    return true;
  }
  if (STATEMENT_DATE_SPLIT.test(text)) {
    return true;
  }
  return STACKED_OPENING_BALANCE.test(text);
}

function accountSummaryRowAmounts(text: string): string[] | null {
  const match = findLabel(text, "Account Summary");
  if (!match) {
    return null;
  }

  const start = (match.index ?? 0) + match[0].length;
  for (const line of text.slice(start, Math.min(text.length, start + 1200)).split("\n")) {
    const stripped = line.trim();
    if (!stripped) {
      continue;
    }
    const amounts = amountsWithPositions(stripped, false);
    if (amounts.length >= 3) {
      return amounts.map(({ amount }) => amount);
    }
  }
  return null;
}

export function accountSummaryOpening(text: string): string | null {
  const row = accountSummaryRowAmounts(text);
  if (row) {
    return row[0] ?? null;
  }
  return null;
}

export function accountSummaryTotalDues(text: string): string | null {
  const row = accountSummaryRowAmounts(text);
  if (row) {
    return row.at(-1) ?? null;
  }
  return null;
}

export function paymentDueTotalDues(text: string): string | null {
  const match = findLabel(text, "Payment Due Date");
  if (!match) {
    return null;
  }

  const start = (match.index ?? 0) + match[0].length;
  for (const line of text.slice(start, Math.min(text.length, start + 400)).split("\n")) {
    const stripped = line.trim();
    if (!stripped || !parseDateString(stripped)) {
      continue;
    }
    const amounts = amountsWithPositions(stripped, false);
    if (amounts.length >= 2) {
      return amounts[0]?.amount ?? null;
    }
  }
  return null;
}

export function approximatePeriodIfNeeded(
  periodStart: Date | null,
  periodEnd: Date | null
): [Date | null, Date | null] {
  if (periodStart && periodEnd) {
    return [periodStart, periodEnd];
  }
  if (periodEnd) {
    const approxStart = parseISO(approxStartFromEnd(format(periodEnd, "yyyy-MM-dd")));
    return [approxStart, periodEnd];
  }
  return [null, null];
}

function previousStatementDuesOpening(text: string): string | null {
  const match = findLabel(text, "PREVIOUS STATEMENT DUES");
  if (!match) {
    return null;
  }

  const start = (match.index ?? 0) + match[0].length;
  for (const line of text.slice(start, Math.min(text.length, start + 600)).split("\n")) {
    const stripped = line.trim();
    if (!stripped) {
      continue;
    }
    const amounts = amountsWithPositions(stripped, false);
    if (amounts.length >= 3) {
      return amounts[0]?.amount ?? null;
    }
  }
  return null;
}

function modernTotalAmountDue(text: string): string | null {
  const match = findLabel(text, "TOTAL AMOUNT DUE");
  if (!match) {
    return null;
  }

  const prefix = text.slice(Math.max(0, (match.index ?? 0) - 40), match.index ?? 0);
  if (/(?:than|the|less)\s+['"]?\s*$/i.test(prefix)) {
    return null;
  }

  const start = (match.index ?? 0) + match[0].length;
  for (const line of text.slice(start, Math.min(text.length, start + 400)).split("\n")) {
    const stripped = line.trim();
    if (!stripped) {
      continue;
    }
    const amounts = amountsWithPositions(stripped, false);
    if (amounts[0]) {
      return amounts[0].amount;
    }
  }
  return null;
}

export function detectSwiggyLayout(text: string): boolean {
  if (isHdfcV2(text)) {
    return true;
  }
  if (findLabel(text, "Billing Period")) {
    return false;
  }
  if (findLabel(text, "PREVIOUS STATEMENT DUES")) {
    return false;
  }
  if (findLabel(text, "TOTAL AMOUNT DUE")) {
    return false;
  }
  return text.toUpperCase().includes("ACCOUNT SUMMARY");
}

export function swiggyOpeningBalance(text: string): string | null {
  if (detectSwiggyLayout(text)) {
    return accountSummaryOpening(text);
  }
  return previousStatementDuesOpening(text);
}

export function swiggyClosingBalance(text: string): string | null {
  if (detectSwiggyLayout(text)) {
    return accountSummaryTotalDues(text) ?? paymentDueTotalDues(text);
  }
  return modernTotalAmountDue(text);
}
