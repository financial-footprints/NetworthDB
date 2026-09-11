export const CALENDAR_END_SOURCES = ["configured", "today"] as const;

export type CalendarEndSource = (typeof CALENDAR_END_SOURCES)[number];

export type CalendarMonthCell = {
  month: number;
  year: number;
  monthKey: string;
};

export type CalendarYearSection = {
  yearKey: string;
  label: string;
  months: CalendarMonthCell[];
};

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resolveCalendarEnd(closingDate: string | null): {
  calendarEnd: string;
  calendarEndSource: CalendarEndSource;
  closingDateConfigured: boolean;
} {
  if (closingDate) {
    return {
      calendarEnd: closingDate,
      calendarEndSource: "configured",
      closingDateConfigured: true,
    };
  }

  return {
    calendarEnd: formatIsoDate(new Date()),
    calendarEndSource: "today",
    closingDateConfigured: false,
  };
}

export function monthKeysBetween(start: Date, end: Date): string[] {
  const months: string[] = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= endMonth) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    cursor = new Date(year, month, 1);
  }

  return months;
}

export function buildCalendarYearSections(
  startDate: string,
  endDate: string
): CalendarYearSection[] {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end || start > end) {
    return [];
  }

  const sections = new Map<number, CalendarMonthCell[]>();
  for (const monthKey of monthKeysBetween(start, end)) {
    const year = Number(monthKey.slice(0, 4));
    const month = Number(monthKey.slice(5, 7));
    const cells = sections.get(year) ?? [];
    cells.push({ month, year, monthKey });
    sections.set(year, cells);
  }

  return [...sections.entries()]
    .sort(([left], [right]) => left - right)
    .map(([year, months]) => ({
      yearKey: String(year),
      label: String(year),
      months,
    }));
}
