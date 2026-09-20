import { describe, expect, test } from "bun:test";
import {
  monthCsvDownloadFormat,
  monthCsvIsViewable,
  monthFormatIsAvailable,
} from "@web/routes/accounts/statements/_parts/calendar/helpers";

describe("formatAvailability", () => {
  test("csv chip is viewable when only parsed transactions exist", () => {
    const availability = {
      month: "2023-12",
      statement_date: "2024-01",
      formats: ["pdf", "transactions"],
    };
    expect(monthCsvIsViewable(availability)).toBe(true);
    expect(monthCsvDownloadFormat(availability)).toBe("transactions");
    expect(monthFormatIsAvailable(availability, "csv")).toBe(false);
  });

  test("prefers bank csv over transactions when both exist", () => {
    const availability = {
      month: "2023-12",
      statement_date: "2024-01",
      formats: ["pdf", "csv", "transactions"],
    };
    expect(monthCsvDownloadFormat(availability)).toBe("csv");
  });
});
