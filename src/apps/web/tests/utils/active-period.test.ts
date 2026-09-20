import { describe, expect, test } from "bun:test";
import {
  DEFAULT_ACTIVE_PERIOD_PRESET,
  parseActivePeriodStored,
  resolveActivePeriodRange,
  withActivePeriod,
} from "@web/utils/active-period";

describe("active period", () => {
  test("defaults when active_period is missing", () => {
    expect(parseActivePeriodStored(undefined)).toEqual({
      preset: "everything",
    });
    expect(DEFAULT_ACTIVE_PERIOD_PRESET).toBe("everything");
  });

  test("resolves everything to today for display bounds", () => {
    const fixed = new Date(2025, 8, 17);
    expect(resolveActivePeriodRange({ preset: "everything" }, fixed)).toEqual({
      from: "2025-09-17",
      to: "2025-09-17",
    });
  });

  test("resolves financial year across April boundary", () => {
    const march = new Date(2025, 2, 31);
    expect(resolveActivePeriodRange({ preset: "this_financial_year" }, march)).toEqual({
      from: "2024-04-01",
      to: "2025-03-31",
    });

    const april = new Date(2025, 3, 1);
    expect(resolveActivePeriodRange({ preset: "this_financial_year" }, april)).toEqual({
      from: "2025-04-01",
      to: "2026-03-31",
    });
  });

  test("resolves previous calendar month", () => {
    const midSeptember = new Date(2025, 8, 17);
    expect(resolveActivePeriodRange({ preset: "previous_month" }, midSeptember)).toEqual({
      from: "2025-08-01",
      to: "2025-08-31",
    });

    const january = new Date(2025, 0, 10);
    expect(resolveActivePeriodRange({ preset: "previous_month" }, january)).toEqual({
      from: "2024-12-01",
      to: "2024-12-31",
    });
  });

  test("resolves this week Monday through Sunday", () => {
    const wednesday = new Date(2025, 8, 17);
    expect(resolveActivePeriodRange({ preset: "this_week" }, wednesday)).toEqual({
      from: "2025-09-15",
      to: "2025-09-21",
    });
  });

  test("parses and validates custom range", () => {
    expect(
      parseActivePeriodStored({
        preset: "custom",
        from: "2024-06-01",
        to: "2024-06-30",
      })
    ).toEqual({
      preset: "custom",
      from: "2024-06-01",
      to: "2024-06-30",
    });

    expect(
      parseActivePeriodStored({
        preset: "custom",
        from: "2024-06-30",
        to: "2024-06-01",
      })
    ).toEqual({ preset: DEFAULT_ACTIVE_PERIOD_PRESET });
  });

  test("withActivePeriod merges without dropping other keys", () => {
    const next = withActivePeriod({ e2ee: { displayName: false } }, { preset: "today" });
    expect(next).toEqual({
      e2ee: { displayName: false },
      active_period: { preset: "today" },
    });
  });
});
