import { describe, expect, test } from "bun:test";
import { getParser } from "@statements/banks/parsers/index";
import { listParserKeys } from "@statements/banks/parsers/registry";

describe("parser registry", () => {
  test("lists registered parser keys", () => {
    const keys = [...listParserKeys()].sort();
    expect(keys).toContain("hdfc/default");
    expect(keys).toContain("icici/amazon");
    expect(keys.length).toBeGreaterThan(10);
  });

  test("falls back hdfc variant to default parser", () => {
    const defaultParser = getParser("hdfc", "default");
    const swiggyParser = getParser("hdfc", "swiggy");
    expect(swiggyParser).toBe(defaultParser);
  });
});
