import { describe, expect, test } from "bun:test";
import { accountDateToMonthYear, compareAccountDates, parseAccountDate } from "@web/utils/time";

describe("account dates from API (ISO)", () => {
  test("accountDateToMonthYear accepts YYYY-MM-DD", () => {
    expect(accountDateToMonthYear("2023-03-17")).toEqual({ year: 2023, month: 3 });
  });

  test("parseAccountDate accepts YYYY-MM-DD", () => {
    const parsed = parseAccountDate("2023-03-17");
    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2023);
    expect(parsed?.getMonth()).toBe(2);
    expect(parsed?.getDate()).toBe(17);
  });

  test("compareAccountDates orders ISO and display forms consistently", () => {
    expect(compareAccountDates("2023-03-17", "17-03-2024")).toBeLessThan(0);
    expect(compareAccountDates("17-03-2023", "2023-03-17")).toBe(0);
  });
});
