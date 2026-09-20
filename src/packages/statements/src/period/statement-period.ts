import { basename } from "node:path";
import {
  addCalendarMonths,
  compareIsoDates,
  formatIsoDate,
  lastDayOfMonth,
  parseIsoDate,
} from "@statements/period/iso-date";

const MONTH_PERIOD_PATTERN = /^(\d{4}-\d{2})$/;
const FILENAME_MONTH_PATTERN = /(\d{4}-\d{2})(?:-\d{2})?/;
const STAGING_EMAIL_DATE_PATTERN =
  /__(\d{4}-\d{2}-\d{2})(?:__annual)?(?:\s+\(\d+\))?\.(?:pdf|csv)$/i;
const FISCAL_YEAR_KEY_PATTERN = /^FY(\d{2})-(\d{4})$/;
const CALENDAR_YEAR_KEY_PATTERN = /^(\d{4})$/;

const MONTH_NAMES: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

export type YearDisplay = "fiscal_year" | "calendar_year";

export function parseMonthPeriod(period: string): string | null {
  const match = MONTH_PERIOD_PATTERN.exec(period);
  if (!match) {
    return null;
  }

  const month = Number(period.slice(5, 7));
  if (month < 1 || month > 12) {
    return null;
  }

  return match[1] ?? null;
}

export function isFyPeriod(period: string): boolean {
  return FISCAL_YEAR_KEY_PATTERN.test(period);
}

export function isCalendarYearPeriod(period: string): boolean {
  return CALENDAR_YEAR_KEY_PATTERN.test(period);
}

export function isAnnualPeriod(period: string): boolean {
  return isFyPeriod(period) || isCalendarYearPeriod(period);
}

export function monthPeriodFromFilename(filename: string): string {
  const match = FILENAME_MONTH_PATTERN.exec(filename);
  return match?.[1] ?? "unknown-month";
}

export function emailDateFromStagingFilename(filename: string): string | null {
  const name = basename(filename);
  const match = STAGING_EMAIL_DATE_PATTERN.exec(name);
  if (!match?.[1]) {
    return null;
  }

  try {
    return formatIsoDate(parseIsoDate(match[1]));
  } catch {
    return null;
  }
}

export function fiscalYearKeyFromMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split("-", 2);
  const year = Number(yearStr);
  const month = Number(monthStr);
  const [fyStart, fyEnd] = month >= 4 ? [year, year + 1] : [year - 1, year];
  return `FY${String(fyStart % 100).padStart(2, "0")}-${fyEnd}`;
}

export function fiscalYearKey(startIso: string, _endIso: string): string {
  const start = parseIsoDate(startIso);
  const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  return fiscalYearKeyFromMonthKey(monthKey);
}

export function coveredMonthsBetween(startIso: string, endIso: string): string[] {
  if (compareIsoDates(endIso, startIso) < 0) {
    return [];
  }

  const months: string[] = [];
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  let year = start.getFullYear();
  let month = start.getMonth() + 1;
  const endYear = end.getFullYear();
  const endMonth = end.getMonth() + 1;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    const next = addCalendarMonths(year, month, 1);
    year = next.y;
    month = next.m;
  }

  return months;
}

export function fyKeyFromDates(startIso: string, endIso: string): string {
  let start = startIso;
  let end = endIso;
  if (compareIsoDates(end, start) < 0) {
    [start, end] = [end, start];
  }

  const months = coveredMonthsBetween(start, end);
  if (months.length === 0) {
    return fiscalYearKey(start, end);
  }

  const fyCounts = new Map<string, number>();
  for (const monthKey of months) {
    const fy = fiscalYearKeyFromMonthKey(monthKey);
    fyCounts.set(fy, (fyCounts.get(fy) ?? 0) + 1);
  }

  let best = "";
  let bestCount = -1;
  for (const [fy, count] of fyCounts) {
    if (count > bestCount) {
      best = fy;
      bestCount = count;
    }
  }

  return best;
}

export function periodForYearKey(
  yearKey: string,
  yearDisplay: YearDisplay = "fiscal_year"
): { start: string; end: string } {
  if (yearDisplay === "fiscal_year") {
    const match = FISCAL_YEAR_KEY_PATTERN.exec(yearKey);
    if (!match) {
      throw new Error("statements.period.invalid.year-key");
    }

    const startYy = Number(match[1]);
    const endYear = Number(match[2]);
    let startYear = Math.floor(endYear / 100) * 100 + startYy;
    if (startYear >= endYear) {
      startYear -= 100;
    }

    return {
      start: formatIsoDate(new Date(startYear, 3, 1)),
      end: formatIsoDate(new Date(endYear, 2, lastDayOfMonth(endYear, 3))),
    };
  }

  const match = CALENDAR_YEAR_KEY_PATTERN.exec(yearKey);
  if (!match) {
    throw new Error("statements.period.invalid.year-key");
  }

  const year = Number(match[1]);
  return {
    start: formatIsoDate(new Date(year, 0, 1)),
    end: formatIsoDate(new Date(year, 11, lastDayOfMonth(year, 12))),
  };
}

function annualFileStem(statementPeriod: string): string {
  if (isCalendarYearPeriod(statementPeriod)) {
    return statementPeriod;
  }

  const match = FISCAL_YEAR_KEY_PATTERN.exec(statementPeriod);
  if (match) {
    return match[2] ?? statementPeriod;
  }

  return statementPeriod;
}

export function statementBasename(statementPeriod: string): string {
  if (isAnnualPeriod(statementPeriod)) {
    return annualFileStem(statementPeriod);
  }

  return statementPeriod;
}

export function parseMonthYearToken(token: string): { y: number; m: number } | null {
  const cleaned = token.trim().toUpperCase();
  const separator = cleaned.lastIndexOf("-");
  if (separator < 0) {
    return null;
  }

  const monthName = cleaned.slice(0, separator).toLowerCase();
  const yearPart = cleaned.slice(separator + 1);
  const month = MONTH_NAMES[monthName];
  if (!month) {
    return null;
  }

  let year: number;
  if (yearPart.length === 2 && /^\d+$/.test(yearPart)) {
    year = 2000 + Number(yearPart);
  } else if (yearPart.length === 4 && /^\d+$/.test(yearPart)) {
    year = Number(yearPart);
  } else {
    return null;
  }

  return { y: year, m: month };
}
