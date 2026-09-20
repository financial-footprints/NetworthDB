import { describe, expect, test } from "bun:test";
import { isAccountClosedForList } from "@core/domains/account/helpers";

describe("isAccountClosedForList", () => {
  test("null closing date is open", () => {
    expect(isAccountClosedForList(null, "2026-01-01")).toBe(false);
  });

  test("closing date on as-of stays open", () => {
    expect(isAccountClosedForList("2026-01-01", "2026-01-01")).toBe(false);
  });

  test("future closing date is open", () => {
    expect(isAccountClosedForList("2026-12-31", "2026-01-01")).toBe(false);
  });

  test("past closing date is closed", () => {
    expect(isAccountClosedForList("2020-01-01", "2026-01-01")).toBe(true);
  });
});
