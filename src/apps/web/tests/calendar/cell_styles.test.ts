import { describe, expect, test } from "bun:test";
import { monthCellClassName } from "@web/routes/statements/shared/helpers/calendarCellStyles";

describe("monthCellClassName", () => {
  test("uses violet for neighbor-month discontinuity", () => {
    expect(monthCellClassName(true, false, "discontinuity")).toBe("calendar-cell-discontinuity");
  });

  test("uses red for activity without a statement", () => {
    expect(monthCellClassName(true, false, "mismatched")).toBe("calendar-cell-mismatched");
  });

  test("uses emerald when monthly statement files are present", () => {
    expect(monthCellClassName(true, true, undefined)).toBe("calendar-cell-files");
  });

  test("uses light green when annual statement covers a month without monthly files", () => {
    expect(monthCellClassName(true, false, undefined, true)).toBe("calendar-cell-annual");
  });

  test("uses amber when no monthly or annual statement is available", () => {
    expect(monthCellClassName(true, false, undefined, false)).toBe("calendar-cell-missing");
  });

  test("monthly files take precedence over annual coverage", () => {
    expect(monthCellClassName(true, true, undefined, true)).toBe("calendar-cell-files");
  });

  test("balance gap status takes precedence over annual coverage", () => {
    expect(monthCellClassName(true, false, "matched", true)).toBe("calendar-cell-matched");
  });
});
