import { addDays, format } from "date-fns";

function parseAccountDateField(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const isoMatch = /^\d{4}-\d{2}-\d{2}$/.exec(trimmed);
  if (isoMatch) {
    const [year, month, day] = trimmed.split("-").map(Number);
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  }

  const dmyMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    return new Date(year, month - 1, day);
  }

  return null;
}

export function utcToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function formatAccountDate(value: Date): string {
  return format(value, "dd-MM-yyyy");
}

export function parseAccountDateStr(value: string): Date | null {
  return parseAccountDateField(value);
}

export function exclusiveSearchEndDate(endDate: Date): Date {
  return addDays(endDate, 1);
}

function incrementalFetchStart(lastFetchDate: Date | null): Date | null {
  return lastFetchDate ? addDays(lastFetchDate, -1) : null;
}

export function resolveAccountSearchDates(
  openingDate: string,
  closingDate: string | null,
  lastFetchDate: Date | null
): { start: Date | null; end: Date | null } {
  const opening = parseAccountDateStr(openingDate);
  const startCandidates: Date[] = [];
  if (opening) {
    startCandidates.push(opening);
  }
  const incremental = incrementalFetchStart(lastFetchDate);
  if (incremental) {
    startCandidates.push(incremental);
  }

  const effectiveStart =
    startCandidates.length > 0
      ? startCandidates.reduce((max, date) => (date > max ? date : max))
      : null;

  const effectiveEnd = closingDate
    ? exclusiveSearchEndDate(parseAccountDateStr(closingDate) ?? utcToday())
    : null;

  return { start: effectiveStart, end: effectiveEnd };
}
