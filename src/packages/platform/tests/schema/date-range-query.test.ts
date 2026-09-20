import { describe, expect, test } from "bun:test";
import { optionalIsoDateRangeQuerySchema } from "@platform/schema/date-range-query";

const schema = optionalIsoDateRangeQuerySchema("Date is invalid.");

describe("optionalIsoDateRangeQuerySchema", () => {
  test("accepts both omitted", () => {
    expect(schema.parse({})).toEqual({});
  });

  test("accepts valid from and to", () => {
    expect(schema.parse({ from: "2024-01-01", to: "2024-06-30" })).toEqual({
      from: "2024-01-01",
      to: "2024-06-30",
    });
  });

  test("rejects one-sided range", () => {
    expect(() => schema.parse({ from: "2024-01-01" })).toThrow();
    expect(() => schema.parse({ to: "2024-01-01" })).toThrow();
  });

  test("rejects inverted range", () => {
    expect(() => schema.parse({ from: "2024-06-30", to: "2024-01-01" })).toThrow();
  });
});
