import { describe, expect, test } from "bun:test";
import {
  formatDateOnly,
  formatDisplayDateCompact,
  formatDisplayDateLong,
  formatTimestamp,
  ordinalSuffix,
} from "@web/utils/time";

describe("ordinalSuffix", () => {
  test("uses st, nd, rd, th correctly", () => {
    expect(ordinalSuffix(1)).toBe("1st");
    expect(ordinalSuffix(2)).toBe("2nd");
    expect(ordinalSuffix(3)).toBe("3rd");
    expect(ordinalSuffix(4)).toBe("4th");
    expect(ordinalSuffix(11)).toBe("11th");
    expect(ordinalSuffix(12)).toBe("12th");
    expect(ordinalSuffix(13)).toBe("13th");
    expect(ordinalSuffix(21)).toBe("21st");
    expect(ordinalSuffix(31)).toBe("31st");
  });
});

describe("formatDisplayDateLong", () => {
  test("formats ISO calendar dates", () => {
    expect(formatDisplayDateLong("2024-06-01")).toBe("1st June 2024");
  });

  test("formats dd-mm-yyyy account dates", () => {
    expect(formatDisplayDateLong("17-03-2023")).toBe("17th March 2023");
  });
});

describe("formatDisplayDateCompact", () => {
  test("normalizes ISO to dd-mm-yyyy", () => {
    expect(formatDisplayDateCompact("2024-06-01")).toBe("01-06-2024");
  });

  test("keeps valid dd-mm-yyyy", () => {
    expect(formatDisplayDateCompact("17-03-2023")).toBe("17-03-2023");
  });
});

describe("formatDateOnly", () => {
  test("uses long display for ISO timestamps", () => {
    expect(formatDateOnly("2026-01-15T12:00:00.000Z")).toBe("15th January 2026");
  });
});

describe("formatTimestamp", () => {
  test("uses long date and 24-hour clock", () => {
    const formatted = formatTimestamp("2024-06-01T14:30:00.000Z");
    expect(formatted).toContain("June 2024");
    expect(formatted).toMatch(/,\s\d{2}:\d{2}$/);
    expect(formatted).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
  });
});
