import { describe, expect, test } from "bun:test";
import { isMonthExpectingStatement } from "@web/utils/time";

const COVERED_THROUGH_FEB_2026 = ["2025-12", "2026-01", "2026-02"];

describe("isMonthExpectingStatement", () => {
  test("returns false when month is outside calendar bounds", () => {
    expect(isMonthExpectingStatement("2026-03", false, false, COVERED_THROUGH_FEB_2026, true)).toBe(
      false
    );
  });

  test("returns true for open accounts when month is in range", () => {
    expect(isMonthExpectingStatement("2026-03", true, false, COVERED_THROUGH_FEB_2026, false)).toBe(
      true
    );
  });

  test("returns true for closed accounts on or before last covered month", () => {
    expect(isMonthExpectingStatement("2026-02", true, false, COVERED_THROUGH_FEB_2026, true)).toBe(
      true
    );
    expect(isMonthExpectingStatement("2026-01", true, false, COVERED_THROUGH_FEB_2026, true)).toBe(
      true
    );
  });

  test("returns false for closed accounts after last covered month without balance gap", () => {
    expect(isMonthExpectingStatement("2026-03", true, false, COVERED_THROUGH_FEB_2026, true)).toBe(
      false
    );
  });

  test("returns true for closed accounts after last covered month with balance gap", () => {
    expect(isMonthExpectingStatement("2026-03", true, true, COVERED_THROUGH_FEB_2026, true)).toBe(
      true
    );
  });

  test("returns true for closed accounts with no covered months", () => {
    expect(isMonthExpectingStatement("2026-03", true, false, [], true)).toBe(true);
  });
});
