import { describe, expect, test } from "bun:test";
import {
  coveredMonthsBetween,
  emailDateFromStagingFilename,
  fiscalYearKey,
  fiscalYearKeyFromMonthKey,
  fyKeyFromDates,
  isAnnualPeriod,
  isFyPeriod,
  monthPeriodFromFilename,
  parseMonthPeriod,
  parseMonthYearToken,
  periodForYearKey,
  statementBasename,
} from "@statements/period/statement-period";

describe("statement-period", () => {
  test("parseMonthPeriod rejects month 13", () => {
    expect(parseMonthPeriod("2024-01")).toBe("2024-01");
    expect(parseMonthPeriod("2024-13")).toBeNull();
  });

  test("fiscalYearKeyFromMonthKey", () => {
    expect(fiscalYearKeyFromMonthKey("2024-01")).toBe("FY23-2024");
    expect(fiscalYearKeyFromMonthKey("2024-04")).toBe("FY24-2025");
  });

  test("statementBasename", () => {
    expect(statementBasename("FY24-2025")).toBe("2025");
    expect(statementBasename("2024")).toBe("2024");
    expect(statementBasename("2024-01")).toBe("2024-01");
  });

  test("emailDateFromStagingFilename", () => {
    expect(emailDateFromStagingFilename("Important__2023-02-18.pdf")).toBe("2023-02-18");
    expect(emailDateFromStagingFilename("INBOX__2023-02-15 (1).pdf")).toBe("2023-02-15");
    expect(emailDateFromStagingFilename("INBOX__2024-05-12__annual.csv")).toBe("2024-05-12");
    expect(emailDateFromStagingFilename("manual__2023-02.pdf")).toBeNull();
  });

  test("fy period round trip", () => {
    const period = "FY24-2025";
    expect(isFyPeriod(period)).toBe(true);
    expect(isAnnualPeriod(period)).toBe(true);
    expect(periodForYearKey(period)).toEqual({ start: "2024-04-01", end: "2025-03-31" });
  });

  test("fiscalYearKey", () => {
    expect(fiscalYearKey("2024-04-01", "2025-03-31")).toBe("FY24-2025");
  });

  test("fyKeyFromDates majority months", () => {
    const cases: Array<[string, string, string]> = [
      ["2022-08-01", "2023-02-28", "FY22-2023"],
      ["2023-04-01", "2024-03-31", "FY23-2024"],
      ["2024-03-17", "2024-05-16", "FY24-2025"],
      ["2025-03-17", "2026-03-16", "FY25-2026"],
    ];

    for (const [start, end, expected] of cases) {
      expect(fyKeyFromDates(start, end)).toBe(expected);
    }
  });

  test("periodForYearKey", () => {
    expect(periodForYearKey("FY24-2025", "fiscal_year")).toEqual({
      start: "2024-04-01",
      end: "2025-03-31",
    });
    expect(periodForYearKey("2024", "calendar_year")).toEqual({
      start: "2024-01-01",
      end: "2024-12-31",
    });
  });

  test("coveredMonthsBetween", () => {
    expect(coveredMonthsBetween("2024-04-01", "2024-06-30")).toEqual([
      "2024-04",
      "2024-05",
      "2024-06",
    ]);
  });

  test("monthPeriodFromFilename", () => {
    expect(monthPeriodFromFilename("statement-2024-03.pdf")).toBe("2024-03");
    expect(monthPeriodFromFilename("attachment.pdf")).toBe("unknown-month");
  });

  test("parseMonthYearToken", () => {
    expect(parseMonthYearToken("APRIL-24")).toEqual({ y: 2024, m: 4 });
    expect(parseMonthYearToken("invalid")).toBeNull();
  });
});
