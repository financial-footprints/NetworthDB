import {
  addIsoCalendarDays,
  compareIsoDateStrings,
  formatIsoDateString,
  parseIsoDateToLocalDate,
  validateIsoDateString,
} from "@ndb/platform";
import { addMonths, endOfMonth } from "date-fns";

export {
  addIsoCalendarDays as addCalendarDays,
  compareIsoDateStrings as compareIsoDates,
  formatIsoDateString as formatIsoDate,
  parseIsoDateToLocalDate as parseIsoDate,
  validateIsoDateString,
};

export function lastDayOfMonth(year: number, month: number): number {
  return endOfMonth(new Date(year, month - 1, 1)).getDate();
}

export function addCalendarMonths(
  year: number,
  month: number,
  delta: number
): { y: number; m: number } {
  const shifted = addMonths(new Date(year, month - 1, 1), delta);
  return { y: shifted.getFullYear(), m: shifted.getMonth() + 1 };
}

export function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, lastDayOfMonth(year, month));
}
