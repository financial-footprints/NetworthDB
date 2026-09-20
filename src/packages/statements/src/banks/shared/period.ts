import { getHandler } from "@statements/banks/handlers/index";
import { PeriodSource } from "@statements/banks/shared/period-source";
import { fyKeyFromDates, monthPeriodFromFilename } from "@statements/period/statement-period";
import { format } from "date-fns";

function annualPeriodWithSource(
  handler: ReturnType<typeof getHandler>,
  text: string
): [string, PeriodSource] | null {
  if (!handler.isAnnualStatement(text)) {
    return null;
  }
  const period = handler.getAnnualPeriod(text);
  if (!period) {
    return null;
  }
  return [
    fyKeyFromDates(format(period[0], "yyyy-MM-dd"), format(period[1], "yyyy-MM-dd")),
    PeriodSource.Annual,
  ];
}

function resolveMonthlyPeriodWithSource(
  handler: ReturnType<typeof getHandler>,
  text: string,
  filename: string
): [string, PeriodSource] {
  const parsed = handler.getStatementDate(text);
  if (parsed) {
    return [format(parsed, "yyyy-MM"), PeriodSource.ContentDate];
  }

  const fallback = monthPeriodFromFilename(filename);
  if (fallback !== "unknown-month") {
    return [fallback, PeriodSource.FilenameFallback];
  }
  return ["unknown-month", PeriodSource.Unknown];
}

export function resolvePeriodKeyWithSource(
  text: string,
  filename: string,
  account: { bank: string; variant?: string | null }
): [string, PeriodSource] {
  const handler = getHandler(account.bank, account.variant ?? undefined);
  if (handler.isAnnualStatement(text)) {
    const annual = annualPeriodWithSource(handler, text);
    if (annual) {
      return annual;
    }
    return ["unknown-month", PeriodSource.Unknown];
  }
  return resolveMonthlyPeriodWithSource(handler, text, filename);
}

export function resolveKeyWithSource(
  csvText: string,
  filename: string,
  account: { bank: string; variant?: string | null }
): [string, PeriodSource] {
  const handler = getHandler(account.bank, account.variant ?? undefined);
  const [period, source] = handler.resolveCsvPeriodWithSource(csvText, filename);
  if (source !== PeriodSource.Unknown) {
    return [period, source];
  }
  return resolvePeriodKeyWithSource(csvText, filename, account);
}
