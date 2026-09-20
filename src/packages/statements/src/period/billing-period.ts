import {
  addCalendarDays,
  addCalendarMonths,
  clampDay,
  formatIsoDate,
  parseIsoDate,
} from "@statements/period/iso-date";

export function approxStartFromEnd(endIso: string): string {
  const end = parseIsoDate(endIso);
  const prev = addCalendarMonths(end.getFullYear(), end.getMonth() + 1, -1);
  const prevDay = clampDay(prev.y, prev.m, end.getDate());
  const prevDate = formatIsoDate(new Date(prev.y, prev.m - 1, prevDay));
  return addCalendarDays(prevDate, 1);
}
