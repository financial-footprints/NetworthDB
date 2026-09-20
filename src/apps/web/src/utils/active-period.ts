import { formatIsoDateString } from "@ndb/platform";
import { fetchMe, patchMeWithToken, withSessionToken } from "@web/utils/api/routes/auth";
import type { MeResponse } from "@web/utils/api/routes/auth/types";
import {
  formatAccountDateRangeLabel,
  normalizeAccountDateInput,
  toIsoAccountDate,
} from "@web/utils/time";

export const ACTIVE_PERIOD_PRESETS = [
  "everything",
  "today",
  "this_week",
  "this_month",
  "previous_month",
  "this_year",
  "this_financial_year",
  "custom",
] as const;

export type ActivePeriodPreset = (typeof ACTIVE_PERIOD_PRESETS)[number];

export type ActivePeriodStored =
  | { preset: Exclude<ActivePeriodPreset, "custom"> }
  | { preset: "custom"; from: string; to: string };

export const DEFAULT_ACTIVE_PERIOD_PRESET: Exclude<ActivePeriodPreset, "custom"> = "everything";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value.trim());
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
  );
}

export function compareIsoDates(left: string, right: string): number {
  return left.localeCompare(right);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function startOfWeekMonday(date: Date): Date {
  const cursor = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = cursor.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  cursor.setDate(cursor.getDate() + diff);
  return cursor;
}

function endOfWeekSunday(date: Date): Date {
  const start = startOfWeekMonday(date);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  end.setDate(end.getDate() + 6);
  return end;
}

function financialYearRange(now: Date): { from: string; to: string } {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const fyStartYear = month >= 4 ? year : year - 1;
  const fyEndYear = fyStartYear + 1;
  return {
    from: formatIsoDateString(new Date(fyStartYear, 3, 1)),
    to: formatIsoDateString(new Date(fyEndYear, 2, lastDayOfMonth(fyEndYear, 3))),
  };
}

export function parseActivePeriodStored(raw: unknown): ActivePeriodStored {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { preset: DEFAULT_ACTIVE_PERIOD_PRESET };
  }

  const record = raw as Record<string, unknown>;
  const preset = record.preset;
  if (typeof preset !== "string" || !ACTIVE_PERIOD_PRESETS.includes(preset as ActivePeriodPreset)) {
    return { preset: DEFAULT_ACTIVE_PERIOD_PRESET };
  }

  if (preset === "custom") {
    const from = typeof record.from === "string" ? record.from.trim() : "";
    const to = typeof record.to === "string" ? record.to.trim() : "";
    if (!isIsoDate(from) || !isIsoDate(to) || compareIsoDates(from, to) > 0) {
      return { preset: DEFAULT_ACTIVE_PERIOD_PRESET };
    }
    return { preset: "custom", from, to };
  }

  return { preset: preset as Exclude<ActivePeriodPreset, "custom"> };
}

export function withActivePeriod(
  current: Record<string, unknown> | null,
  stored: ActivePeriodStored
): Record<string, unknown> {
  const base = current ? { ...current } : {};
  return {
    ...base,
    active_period: stored,
  };
}

export function resolveActivePeriodRange(
  stored: ActivePeriodStored,
  now = new Date()
): { from: string; to: string } {
  const today = formatIsoDateString(now);

  switch (stored.preset) {
    case "everything":
      return { from: today, to: today };
    case "today":
      return { from: today, to: today };
    case "this_week":
      return {
        from: formatIsoDateString(startOfWeekMonday(now)),
        to: formatIsoDateString(endOfWeekSunday(now)),
      };
    case "this_month": {
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      return {
        from: formatIsoDateString(new Date(year, month - 1, 1)),
        to: formatIsoDateString(new Date(year, month - 1, lastDayOfMonth(year, month))),
      };
    }
    case "previous_month": {
      const cursor = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const year = cursor.getFullYear();
      const month = cursor.getMonth() + 1;
      return {
        from: formatIsoDateString(new Date(year, month - 1, 1)),
        to: formatIsoDateString(new Date(year, month - 1, lastDayOfMonth(year, month))),
      };
    }
    case "this_year": {
      const year = now.getFullYear();
      return {
        from: formatIsoDateString(new Date(year, 0, 1)),
        to: formatIsoDateString(new Date(year, 11, lastDayOfMonth(year, 12))),
      };
    }
    case "this_financial_year":
      return financialYearRange(now);
    case "custom":
      return { from: stored.from, to: stored.to };
    default:
      return financialYearRange(now);
  }
}

export function isUnboundedActivePeriod(stored: ActivePeriodStored): boolean {
  return stored.preset === "everything";
}

export function activePeriodPresetLabel(preset: ActivePeriodPreset): string {
  switch (preset) {
    case "everything":
      return "Everything";
    case "today":
      return "Today";
    case "this_week":
      return "This Week";
    case "this_month":
      return "This Month";
    case "previous_month":
      return "Previous Month";
    case "this_year":
      return "This Year";
    case "this_financial_year":
      return "This Financial Year";
    case "custom":
      return "Custom Range";
    default:
      return "Active Period";
  }
}

export function activePeriodRangeLabel(
  fromIso: string,
  toIso: string,
  options?: { compact?: boolean }
): string {
  const start = normalizeAccountDateInput(fromIso);
  const end = normalizeAccountDateInput(toIso);
  return formatAccountDateRangeLabel(start, end, options);
}

export function defaultTransactionDateForPeriod(
  fromIso: string,
  toIso: string,
  now = new Date(),
  unbounded = false
): string {
  const todayIso = formatIsoDateString(now);
  if (unbounded) {
    return todayIso;
  }
  if (compareIsoDates(todayIso, fromIso) >= 0 && compareIsoDates(todayIso, toIso) <= 0) {
    return todayIso;
  }
  return toIso;
}

export function accountDateToIso(value: string): string {
  const trimmed = value.trim();
  if (isIsoDate(trimmed)) {
    return trimmed;
  }
  return toIsoAccountDate(trimmed);
}

export function isoToAccountDate(value: string): string {
  return normalizeAccountDateInput(value);
}

export async function saveActivePeriod(stored: ActivePeriodStored): Promise<MeResponse> {
  return withSessionToken(async (sessionToken) => {
    const me = await fetchMe(sessionToken);
    const nextSettings = withActivePeriod(me.clientSettings ?? null, stored);
    await patchMeWithToken(sessionToken, { clientSettings: nextSettings });
    return fetchMe(sessionToken);
  });
}
