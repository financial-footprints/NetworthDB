export type MonthYear = {
  month: number;
  year: number;
};

const ACCOUNT_DATE_PATTERN = /^(\d{2})-(\d{2})-(\d{4})$/;
const ISO_ACCOUNT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
export const MIN_ACCOUNT_DATE = "01-01-1970";
const MIN_ACCOUNT_DATE_VALUE = new Date(1970, 0, 1);

function maxAccountDateYear(now = new Date()): number {
  return now.getFullYear();
}

export function maxAccountDateLabel(now = new Date()): string {
  const year = maxAccountDateYear(now);
  return `31-12-${String(year).padStart(4, "0")}`;
}

type AccountDateValidationResult =
  | { ok: true; date: Date }
  | { ok: false; reason: "invalid" | "too_early" | "too_late" };

function isOnOrAfterMinAccountDate(parsed: Date): boolean {
  return parsed.getTime() >= MIN_ACCOUNT_DATE_VALUE.getTime();
}

function isWithinMaxAccountDateYear(parsed: Date, now = new Date()): boolean {
  return parsed.getFullYear() <= maxAccountDateYear(now);
}

function parseAccountDateParts(day: number, month: number, year: number): Date | "invalid" {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return "invalid";
  }
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return "invalid";
  }
  return parsed;
}

function validateParsedAccountDate(
  parsed: Date | "invalid",
  now: Date
): AccountDateValidationResult {
  if (parsed === "invalid") {
    return { ok: false, reason: "invalid" };
  }
  if (!isOnOrAfterMinAccountDate(parsed)) {
    return { ok: false, reason: "too_early" };
  }
  if (!isWithinMaxAccountDateYear(parsed, now)) {
    return { ok: false, reason: "too_late" };
  }
  return { ok: true, date: parsed };
}

export function validateAccountDateInput(
  value: string,
  now = new Date()
): AccountDateValidationResult {
  const trimmed = value.trim();
  const match = ACCOUNT_DATE_PATTERN.exec(trimmed);
  if (match) {
    const parsed = parseAccountDateParts(Number(match[1]), Number(match[2]), Number(match[3]));
    return validateParsedAccountDate(parsed, now);
  }

  const isoMatch = ISO_ACCOUNT_DATE_PATTERN.exec(trimmed);
  if (isoMatch) {
    const parsed = parseAccountDateParts(
      Number(isoMatch[3]),
      Number(isoMatch[2]),
      Number(isoMatch[1])
    );
    return validateParsedAccountDate(parsed, now);
  }

  return { ok: false, reason: "invalid" };
}

export function parseAccountDate(value: string): Date | null {
  const result = validateAccountDateInput(value);
  return result.ok ? result.date : null;
}

export function normalizeAccountDateInput(value: string | null | undefined): string {
  if (!value?.trim()) {
    return "";
  }

  const trimmed = value.trim();
  const isoMatch = ISO_ACCOUNT_DATE_PATTERN.exec(trimmed);
  if (isoMatch) {
    return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
  }

  return trimmed;
}

export function toIsoAccountDate(value: string): string {
  const trimmed = value.trim();
  const match = ACCOUNT_DATE_PATTERN.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid account date: ${value}`);
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function formatAccountDate(value: Date): string {
  return `${String(value.getDate()).padStart(2, "0")}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getFullYear()).padStart(4, "0")}`;
}

export function maskAccountDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

export function maxAccountDate(now = new Date()): Date {
  return new Date(maxAccountDateYear(now), 11, 31);
}

export function accountDateToMonthYear(value: string): MonthYear | null {
  const parsed = parseAccountDate(value);
  if (!parsed) return null;
  return { month: parsed.getMonth() + 1, year: parsed.getFullYear() };
}

export function compareAccountDates(left: string, right: string): number {
  const leftDate = parseAccountDate(left);
  const rightDate = parseAccountDate(right);
  if (!leftDate || !rightDate) return left.localeCompare(right);
  return leftDate.getTime() - rightDate.getTime();
}

export function addDaysToAccountDate(value: string, days: number): string | null {
  const parsed = parseAccountDate(value);
  if (!parsed) return null;
  const next = new Date(parsed);
  next.setDate(next.getDate() + days);
  return formatAccountDate(next);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function inclusiveDaysBetweenAccountDates(start: string, end: string): number {
  const startDate = parseAccountDate(start);
  const endDate = parseAccountDate(end);
  if (!startDate || !endDate || endDate < startDate) return 0;
  return Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
}

export function todayAccountDate(now = new Date()): string {
  return formatAccountDate(now);
}

export const FULL_MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function ordinalSuffix(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${day}th`;
  }
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

export function formatDisplayDateLong(value: string): string {
  const normalized = normalizeAccountDateInput(value.trim());
  if (!normalized) {
    return value;
  }
  const parsed = parseAccountDate(normalized);
  if (!parsed) {
    return value;
  }
  const day = parsed.getDate();
  const month = parsed.getMonth();
  const year = parsed.getFullYear();
  return `${ordinalSuffix(day)} ${FULL_MONTH_LABELS[month]} ${year}`;
}

export function formatDisplayDateCompact(value: string): string {
  const normalized = normalizeAccountDateInput(value.trim());
  if (!normalized) {
    return value;
  }
  const parsed = parseAccountDate(normalized);
  if (!parsed) {
    return value;
  }
  return formatAccountDate(parsed);
}

export function formatAccountDateLabel(value: string): string {
  return formatDisplayDateLong(value);
}

type AccountDateRangeLabelOptions = {
  compact?: boolean;
};

function formatAccountDateRangePart(value: string, compact: boolean): string {
  return compact ? formatDisplayDateCompact(value) : formatAccountDateLabel(value);
}

export function formatAccountDateRangeLabel(
  start: string,
  end: string,
  options?: AccountDateRangeLabelOptions
): string {
  const compact = options?.compact === true;
  if (start === end) {
    return formatAccountDateRangePart(start, compact);
  }
  return `${formatAccountDateRangePart(start, compact)} – ${formatAccountDateRangePart(end, compact)}`;
}

const YEAR_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

function parseYearMonth(value: string): MonthYear | null {
  const match = YEAR_MONTH_PATTERN.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { month, year };
}

function toYearMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function formatYearMonthLabel(value: string): string {
  const parsed = parseYearMonth(value);
  if (!parsed) return value;
  return `${MONTH_LABELS[parsed.month - 1]} ${parsed.year}`;
}

export function statementDateForCoveredMonth(coveredMonth: string): string {
  const parsed = parseYearMonth(coveredMonth);
  if (!parsed) {
    return coveredMonth;
  }
  if (parsed.month === 12) {
    return `${parsed.year + 1}-01`;
  }
  return toYearMonthKey(parsed.year, parsed.month + 1);
}

export function currentMonthYear(now = new Date()): MonthYear {
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function isMonthInRange(
  year: number,
  month: number,
  start: MonthYear,
  end: MonthYear
): boolean {
  const value = year * 100 + month;
  const startValue = start.year * 100 + start.month;
  const endValue = end.year * 100 + end.month;
  return value >= startValue && value <= endValue;
}

export function isMonthExpectingStatement(
  monthKey: string,
  inMonthRange: boolean,
  hasBalanceGap: boolean,
  coveredMonths: readonly string[],
  accountClosed: boolean
): boolean {
  if (!inMonthRange) {
    return false;
  }
  if (!accountClosed) {
    return true;
  }
  if (coveredMonths.length === 0) {
    return true;
  }

  const lastCoveredMonth = coveredMonths.reduce((max, month) => (month > max ? month : max));
  if (monthKey <= lastCoveredMonth) {
    return true;
  }

  return hasBalanceGap;
}

export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatDuration(createdAt: string, completedAt: string | null): string | null {
  const start = Date.parse(createdAt);
  if (Number.isNaN(start)) {
    return null;
  }

  const end = completedAt ? Date.parse(completedAt) : Date.now();
  if (Number.isNaN(end)) {
    return null;
  }

  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function formatRelativeTime(isoDate: string): string {
  const date = Date.parse(isoDate);
  if (Number.isNaN(date)) {
    return isoDate;
  }

  const seconds = Math.round((date - Date.now()) / 1000);
  const absSeconds = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (absSeconds < 60) {
    return formatter.format(seconds, "second");
  }

  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) {
    return formatter.format(minutes, "minute");
  }

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return formatter.format(hours, "hour");
  }

  const days = Math.round(hours / 24);
  return formatter.format(days, "day");
}

function formatClockTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatTimestamp(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return `${formatDisplayDateLong(formatAccountDate(date))}, ${formatClockTime(date)}`;
}

export function formatDateOnly(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return formatDisplayDateLong(formatAccountDate(date));
}
