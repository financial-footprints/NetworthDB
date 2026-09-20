/**
 * Instants use Date (User, Session, Job, VaultSlot).
 * Calendar days use YYYY-MM-DD strings (Account opening/closing, Transaction.date).
 * Ledger createdAt is still an ISO string on Transaction/Category/Tag/Rule; do not change those types in this phase.
 */
import { ValidationError } from "@core/shared/errors/domain-error";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toUtcDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = date.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const Time = {
  toUtcDate,

  parseIsoDate(value: string, field: string): string {
    const trimmed = value.trim();
    if (!ISO_DATE_PATTERN.test(trimmed)) {
      throw new ValidationError("Date is invalid.", { field, value: trimmed });
    }

    return trimmed;
  },

  compareIsoDates(left: string, right: string): number {
    const a = toUtcDate(left).getTime();
    const b = toUtcDate(right).getTime();
    if (a < b) {
      return -1;
    }
    if (a > b) {
      return 1;
    }
    return 0;
  },

  addIsoCalendarDays(iso: string, days: number): string {
    const date = toUtcDate(iso);
    date.setUTCDate(date.getUTCDate() + days);
    return fromUtcDate(date);
  },

  yearMonthFromIso(iso: string): { year: number; month: number } {
    const [y, m] = iso.split("-");
    return { year: Number.parseInt(y ?? "0", 10), month: Number.parseInt(m ?? "0", 10) };
  },

  monthStartIso(year: number, month: number): string {
    return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-01`;
  },

  monthEndIso(year: number, month: number): string {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${lastDay.toString().padStart(2, "0")}`;
  },

  utcTodayIsoDate(): string {
    return fromUtcDate(new Date());
  },
};
