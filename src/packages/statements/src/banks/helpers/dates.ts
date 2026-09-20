import { isValid, parse } from "date-fns";

const DATE_FORMATS = [
  "dd/MM/yyyy",
  "dd-MM-yyyy",
  "dd/MMM/yyyy",
  "dd/MMM/yy",
  "dd MMM, yyyy",
  "dd MMM yyyy",
  "dd MMM yy",
  "dd MMMM, yyyy",
  "dd MMMM yyyy",
  "MMMM dd, yyyy",
  "dd-MMM-yyyy",
  "dd-MMM-yy",
];

const DATE_CANDIDATE =
  /(?:\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}-\d{1,2}-\d{4}|\d{1,2}\/[A-Za-z]{3}\/\d{4}|\d{1,2}-[A-Za-z]{3}-\d{4}|\d{1,2}\s+[A-Za-z]{3,9},?\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi;

const SPACED_DAY = /(\d)\s+(\d-[A-Za-z]{3}-\d{4})/gi;

const labelCache = new Map<string, RegExp>();

function normalizeSpacedDateText(text: string): string {
  return text.replace(SPACED_DAY, "$1$2");
}

export function parseDateString(value: string): Date | null {
  const stripped = value.trim().replace(/,$/, "");
  if (!stripped) {
    return null;
  }

  for (const fmt of DATE_FORMATS) {
    const parsed = parse(stripped, fmt, new Date(2000, 0, 1));
    if (isValid(parsed)) {
      return parsed;
    }
  }
  return null;
}

function wordPattern(word: string): string {
  const trimmed = word.trim();
  if (!trimmed) {
    return "";
  }
  if (/^[A-Za-z]+$/.test(trimmed)) {
    return [...trimmed]
      .map((ch) => `${ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}+\\s*`)
      .join("")
      .replace(/\\s*$/, "");
  }
  return trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function labelRegex(label: string): RegExp {
  const cached = labelCache.get(label);
  if (cached) {
    return cached;
  }

  const body = label
    .split(/\s+/)
    .map((word) => wordPattern(word))
    .filter((word) => word.length > 0)
    .join("\\s+");
  const re = new RegExp(body, "i");
  labelCache.set(label, re);
  return re;
}

export function findLabel(text: string, label: string): RegExpMatchArray | null {
  const limit = Math.min(text.length, 4000);
  return labelRegex(label).exec(text.slice(0, limit));
}

function firstDateInText(text: string): Date | null {
  const normalized = normalizeSpacedDateText(text);
  for (const match of normalized.matchAll(DATE_CANDIDATE)) {
    const parsed = parseDateString(match[0]);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}

function lastDateInText(text: string): Date | null {
  const normalized = normalizeSpacedDateText(text);
  let last: Date | null = null;
  for (const match of normalized.matchAll(DATE_CANDIDATE)) {
    const parsed = parseDateString(match[0]);
    if (parsed) {
      last = parsed;
    }
  }
  return last;
}

function boundsFromJoiner(left: string, right: string): [Date | null, Date | null] {
  return [lastDateInText(left), firstDateInText(right)];
}

function lineRemainderAfterMatch(text: string, start: number, end: number): string {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = text.indexOf("\n", end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const line = text.slice(lineStart, lineEnd);
  const offset = end - lineStart;
  return line.slice(offset);
}

export function lineRemainderAfterLabel(text: string, label: string): string | null {
  const match = findLabel(text, label);
  if (!match) {
    return null;
  }
  const start = match.index ?? 0;
  const end = start + match[0].length;
  return lineRemainderAfterMatch(text, start, end);
}

function dateFromRemainder(remainder: string): Date | null {
  for (const joiner of [" to ", " - ", " To "]) {
    const pos = remainder.indexOf(joiner);
    if (pos === -1) {
      continue;
    }
    const left = remainder.slice(0, pos);
    const right = remainder.slice(pos + joiner.length);
    const [, periodEnd] = boundsFromJoiner(left, right);
    if (periodEnd) {
      return periodEnd;
    }
  }
  return firstDateInText(remainder);
}

function dateFromFollowingLines(text: string, end: number): Date | null {
  const sliceEnd = Math.min(text.length, end + 4000);
  const tail = text.slice(end, sliceEnd);
  const searchText = tail.includes("\n") ? tail.slice(tail.indexOf("\n") + 1) : tail;
  for (const line of searchText.split("\n")) {
    const stripped = line.trim();
    if (!stripped) {
      continue;
    }
    const parsed = firstDateInText(stripped);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}

export function dateAfterLabel(text: string, label: string): Date | null {
  const match = findLabel(text, label);
  if (!match) {
    return null;
  }

  const start = match.index ?? 0;
  const end = start + match[0].length;
  const remainder = lineRemainderAfterMatch(text, start, end);
  if (remainder.trim()) {
    const inline = dateFromRemainder(remainder);
    if (inline) {
      return inline;
    }
  }

  return dateFromFollowingLines(text, end);
}

function parseRangeBounds(remainder: string): [Date | null, Date | null] {
  for (const joiner of [" to ", " - ", " To "]) {
    const pos = remainder.indexOf(joiner);
    if (pos !== -1) {
      const left = remainder.slice(0, pos);
      const right = remainder.slice(pos + joiner.length);
      const [start, end] = boundsFromJoiner(left, right);
      if (start && end) {
        return [start, end];
      }
    }
  }
  return [null, firstDateInText(remainder)];
}

export function labelSingleDateEnd(text: string, label: string): Date | null {
  const remainder = lineRemainderAfterLabel(text, label);
  if (!remainder) {
    return null;
  }
  const [, end] = parseRangeBounds(remainder);
  return end;
}

export function labelRangePeriod(
  text: string,
  label: string,
  joiner: string
): [Date | null, Date | null] {
  const match = findLabel(text, label);
  if (!match) {
    return [null, null];
  }

  const end = (match.index ?? 0) + match[0].length;
  const remainder = text.slice(end, Math.min(text.length, end + 300));
  if (!remainder.includes(joiner)) {
    return [null, null];
  }

  const pos = remainder.indexOf(joiner);
  const left = remainder.slice(0, pos);
  const right = remainder.slice(pos + joiner.length);
  return boundsFromJoiner(left, right);
}

export function labelRangeEnd(text: string, label: string, joiner: string): Date | null {
  return labelRangePeriod(text, label, joiner)[1];
}

export function contextRangePeriod(
  text: string,
  context: string,
  joiner: string
): [Date | null, Date | null] {
  const escapedContext = context.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const contextRe = new RegExp(escapedContext, "gi");
  const haystack = text.slice(0, Math.min(text.length, 4000));

  for (const contextMatch of haystack.matchAll(contextRe)) {
    const start = Math.max(0, (contextMatch.index ?? 0) - 250);
    const endPos = Math.min(haystack.length, (contextMatch.index ?? 0) + context.length + 500);
    const window = haystack.slice(start, endPos);
    const escapedJoiner = joiner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const joinerRe = new RegExp(escapedJoiner, "g");

    for (const joinerMatch of window.matchAll(joinerRe)) {
      const joinStart = joinerMatch.index ?? 0;
      const left = window.slice(Math.max(0, joinStart - 80), joinStart);
      const right = window.slice(
        joinStart + joiner.length,
        Math.min(window.length, joinStart + joiner.length + 80)
      );
      const [periodStart, periodEnd] = boundsFromJoiner(left, right);
      if (periodStart && periodEnd) {
        return [periodStart, periodEnd];
      }
    }
  }
  return [null, null];
}

export function contextRangeEnd(text: string, context: string, joiner: string): Date | null {
  const [, end] = contextRangePeriod(text, context, joiner);
  if (end) {
    return end;
  }

  const escapedContext = context.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const contextRe = new RegExp(escapedContext, "gi");
  const haystack = text.slice(0, Math.min(text.length, 4000));

  for (const contextMatch of haystack.matchAll(contextRe)) {
    const start = Math.max(0, (contextMatch.index ?? 0) - 250);
    const endPos = Math.min(haystack.length, (contextMatch.index ?? 0) + context.length + 500);
    const window = haystack.slice(start, endPos);
    const escapedJoiner = joiner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const joinerRe = new RegExp(escapedJoiner, "g");

    for (const joinerMatch of window.matchAll(joinerRe)) {
      const joinStart = joinerMatch.index ?? 0;
      const left = window.slice(Math.max(0, joinStart - 80), joinStart);
      const right = window.slice(
        joinStart + joiner.length,
        Math.min(window.length, joinStart + joiner.length + 80)
      );
      const leftDate = lastDateInText(left);
      const rightDate = firstDateInText(right);
      if (leftDate && rightDate) {
        return rightDate;
      }
    }
  }
  return null;
}

export function topRangePeriodWithChars(
  text: string,
  joiner: string,
  searchChars: number
): [Date | null, Date | null] {
  const haystack = text.slice(0, Math.min(text.length, searchChars));
  const escapedJoiner = joiner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const joinerRe = new RegExp(escapedJoiner, "g");

  for (const match of haystack.matchAll(joinerRe)) {
    const joinStart = match.index ?? 0;
    const left = haystack.slice(Math.max(0, joinStart - 80), joinStart);
    const right = haystack.slice(
      joinStart + joiner.length,
      Math.min(haystack.length, joinStart + joiner.length + 80)
    );
    const [start, end] = boundsFromJoiner(left, right);
    if (start && end) {
      return [start, end];
    }
  }
  return [null, null];
}

export function topRangePeriod(text: string, joiner: string): [Date | null, Date | null] {
  return topRangePeriodWithChars(text, joiner, 2000);
}

export function topRangeEnd(text: string, joiner: string, searchChars: number): Date | null {
  const [, end] = topRangePeriodWithChars(text, joiner, searchChars);
  if (end) {
    return end;
  }

  const haystack = text.slice(0, Math.min(text.length, searchChars));
  const escapedJoiner = joiner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const joinerRe = new RegExp(escapedJoiner, "g");

  for (const match of haystack.matchAll(joinerRe)) {
    const joinStart = match.index ?? 0;
    const left = haystack.slice(Math.max(0, joinStart - 80), joinStart);
    const right = haystack.slice(
      joinStart + joiner.length,
      Math.min(haystack.length, joinStart + joiner.length + 80)
    );
    const leftDate = lastDateInText(left);
    const rightDate = firstDateInText(right);
    if (leftDate && rightDate) {
      return rightDate;
    }
  }
  return null;
}
