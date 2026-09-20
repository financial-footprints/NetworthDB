import { describe, expect, test } from "bun:test";
import {
  addIsoCalendarDays,
  compareIsoDateStrings,
  parseIsoDateToLocalDate,
  validateIsoDateString,
} from "@platform/schema/iso-date";

describe("iso-date", () => {
  test("validateIsoDateString accepts yyyy-mm-dd", () => {
    expect(validateIsoDateString("2024-01-15")).toBe("2024-01-15");
  });

  test("validateIsoDateString rejects invalid calendar dates", () => {
    expect(() => parseIsoDateToLocalDate("2024-02-30")).toThrow("platform.date.invalid.calendar");
  });

  test("compareIsoDateStrings orders chronologically", () => {
    expect(compareIsoDateStrings("2024-01-01", "2024-02-01")).toBeLessThan(0);
  });

  test("addIsoCalendarDays shifts by days", () => {
    expect(addIsoCalendarDays("2024-01-31", 1)).toBe("2024-02-01");
  });
});
