import { isInstrumentAccountType } from "@core/domains/account/constants";
import type {
  DashboardAccountAmount,
  DashboardNamedAmount,
  DashboardSeriesPoint,
  SeriesBucket,
} from "@core/domains/account/dashboard/types";
import {
  isIncomeCounterpart,
  isSpendCounterpart,
} from "@core/domains/account/transactions/helpers";
import { Time } from "@core/shared/time";

export type DashboardMovementKind = "spend" | "income" | "transfer" | "other";

export function classifyDashboardMovement(
  sourceType: string,
  destType: string
): DashboardMovementKind {
  const sourceInstrument = isInstrumentAccountType(sourceType);
  const destInstrument = isInstrumentAccountType(destType);
  if (sourceInstrument && destInstrument) {
    return "transfer";
  }
  if (sourceInstrument && isSpendCounterpart(destType)) {
    return "spend";
  }
  if (destInstrument && isIncomeCounterpart(sourceType)) {
    return "income";
  }
  return "other";
}

export function inclusiveDayCount(from: string, to: string): number {
  const start = Time.toUtcDate(from).getTime();
  const end = Time.toUtcDate(to).getTime();
  const diff = Math.floor((end - start) / (24 * 60 * 60 * 1000));
  return diff + 1;
}

export function startOfIsoWeekUtc(iso: string): string {
  const day = Time.toUtcDate(iso).getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return Time.addIsoCalendarDays(iso, offset);
}

export function chooseSeriesBucket(from: string, to: string): SeriesBucket {
  const days = inclusiveDayCount(from, to);
  if (days <= 45) {
    return "day";
  }
  if (days <= 400) {
    return "week";
  }
  return "month";
}

function monthStartForIso(iso: string): string {
  const { year, month } = Time.yearMonthFromIso(iso);
  return Time.monthStartIso(year, month);
}

function nextMonthStart(iso: string): string {
  const { year, month } = Time.yearMonthFromIso(iso);
  if (month === 12) {
    return Time.monthStartIso(year + 1, 1);
  }
  return Time.monthStartIso(year, month + 1);
}

export function enumerateBucketStarts(from: string, to: string, bucket: SeriesBucket): string[] {
  const starts: string[] = [];
  let current =
    bucket === "day" ? from : bucket === "week" ? startOfIsoWeekUtc(from) : monthStartForIso(from);

  while (Time.compareIsoDates(current, to) <= 0) {
    starts.push(current);
    if (bucket === "day") {
      current = Time.addIsoCalendarDays(current, 1);
    } else if (bucket === "week") {
      current = Time.addIsoCalendarDays(current, 7);
    } else {
      current = nextMonthStart(current);
    }
  }
  return starts;
}

export function fillSeries(
  from: string,
  to: string,
  bucket: SeriesBucket,
  points: DashboardSeriesPoint[]
): DashboardSeriesPoint[] {
  const byStart = new Map(points.map((p) => [p.bucketStart, p]));
  return enumerateBucketStarts(from, to, bucket).map((bucketStart) => {
    const existing = byStart.get(bucketStart);
    return existing ?? { bucketStart, income: 0, spend: 0 };
  });
}

function sortNamedAmounts<T extends { amount: number; name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (b.amount !== a.amount) {
      return b.amount - a.amount;
    }
    return a.name.localeCompare(b.name);
  });
}

export function sortDashboardNamedAmounts(items: DashboardNamedAmount[]) {
  return sortNamedAmounts(items).filter((item) => item.amount !== 0);
}

export function sortDashboardAccountAmounts(items: DashboardAccountAmount[]) {
  return [...items]
    .filter((item) => item.amount !== 0)
    .sort((a, b) => {
      if (b.amount !== a.amount) {
        return b.amount - a.amount;
      }
      return a.label.localeCompare(b.label);
    });
}

export function seriesBucketStartForDate(date: string, bucket: SeriesBucket): string {
  if (bucket === "day") {
    return date;
  }
  if (bucket === "week") {
    return startOfIsoWeekUtc(date);
  }
  return `${date.slice(0, 7)}-01`;
}
