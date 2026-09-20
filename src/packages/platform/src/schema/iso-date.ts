import { addDays, format, isAfter, isBefore } from "date-fns";
import { z } from "zod";

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateIsoDateString(value: string): string {
  const trimmed = value.trim();
  if (!ISO_DATE_PATTERN.test(trimmed)) {
    throw new Error("platform.date.invalid.format");
  }

  return trimmed;
}

export function parseIsoDateToLocalDate(iso: string): Date {
  const normalized = validateIsoDateString(iso);
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  if (
    date.getFullYear() !== (year ?? 0) ||
    date.getMonth() !== (month ?? 1) - 1 ||
    date.getDate() !== (day ?? 1)
  ) {
    throw new Error("platform.date.invalid.calendar");
  }

  return date;
}

export function formatIsoDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function compareIsoDateStrings(left: string, right: string): number {
  const a = parseIsoDateToLocalDate(left);
  const b = parseIsoDateToLocalDate(right);
  if (isBefore(a, b)) {
    return -1;
  }
  if (isAfter(a, b)) {
    return 1;
  }
  return 0;
}

export function addIsoCalendarDays(iso: string, days: number): string {
  return formatIsoDateString(addDays(parseIsoDateToLocalDate(iso), days));
}

export function isoDateFieldSchema(message: string) {
  return z
    .string()
    .refine(
      (value) => {
        try {
          validateIsoDateString(value);
          return true;
        } catch {
          return false;
        }
      },
      { error: message }
    )
    .transform((value) => validateIsoDateString(value));
}
