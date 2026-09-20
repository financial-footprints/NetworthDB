import { describe, expect, test } from "bun:test";
import { monthKeysBetween } from "@core/shared/calendar";

describe("monthKeysBetween", () => {
  test("returns inclusive month keys between two dates", () => {
    expect(monthKeysBetween(new Date(2023, 3, 1), new Date(2023, 5, 30))).toEqual([
      "2023-04",
      "2023-05",
      "2023-06",
    ]);
  });

  test("returns single month when start and end are in the same month", () => {
    expect(monthKeysBetween(new Date(2024, 0, 5), new Date(2024, 0, 20))).toEqual(["2024-01"]);
  });

  test("returns empty array when start is after end", () => {
    expect(monthKeysBetween(new Date(2024, 5, 1), new Date(2024, 3, 1))).toEqual([]);
  });
});
