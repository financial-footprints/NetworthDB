import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FederalEdgeParser, FederalSignetParser } from "@statements/banks/institutions/federal";
import { IciciStatementParser } from "@statements/banks/institutions/icici";
import { getParser } from "@statements/banks/parsers/index";

const FIXTURES_ROOT = join(import.meta.dir, "..", "..", "fixtures");

function fixturePath(...parts: string[]): string {
  return join(FIXTURES_ROOT, ...parts);
}

function readFixture(...parts: string[]): string {
  return readFileSync(fixturePath(...parts), "utf8");
}

describe("bank parsers", () => {
  test("federal signet parses format1", () => {
    const text = readFixture("federal", "signet", "format1.txt");
    const rows = FederalSignetParser.parse(text, "2021-04.pdf");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.debited).toBe("10.00");
    expect(rows[1]?.credited).toBe("10.00");
  });

  test("federal edge parses repayment credit", () => {
    const text = readFixture("federal", "edge", "format1.txt");
    const rows = FederalEdgeParser.parse(text, "2021-01.pdf");
    expect(rows).toHaveLength(4);
    const repayment = rows.find((row) => row.description.includes("Repayment"));
    expect(repayment?.credited).toBe("830.00");
  });

  test("icici parses amazon format1", () => {
    const text = readFixture("icici", "amazon", "format1.txt");
    const rows = IciciStatementParser.parse(text, "2021-10.pdf");
    expect(rows).toHaveLength(3);
    expect(rows[0]?.debited).toBe("275.50");
    expect(rows[1]?.credited).toBe("1380.00");
    expect(rows[1]?.refNo).toBe("88472910562");
  });

  test("icici parses annual csv", () => {
    const text = readFixture("icici", "csv", "annual-sample.csv");
    const rows = IciciStatementParser.parse(text, "yearly-sample.csv");
    expect(rows).toHaveLength(9);
  });

  test("pnb platinum parses format1", () => {
    const text = readFixture("pnb", "platinum", "format1.txt");
    const parser = getParser("pnb", "platinum");
    const rows = parser.parse(text, "2021-05.pdf");
    expect(rows.length).toBeGreaterThan(0);
  });

  test("bob easy parses format6 Nov 2025 statement", () => {
    const parser = getParser("bob", "easy");
    const text = readFixture("bob", "easy", "format6.txt");
    const rows = parser.parse(text, "2025-11.pdf");
    expect(rows).toHaveLength(3);
    const amazon = rows.filter((row) => row.description === "AMAZON");
    expect(amazon).toHaveLength(2);
    expect(amazon[0]?.credited).toBe("215.10");
    expect(amazon[1]?.credited).toBe("943.20");
    const bbps = rows.find((row) => row.description === "BBPS-PAYMENT");
    expect(bbps?.credited).toBe("2179.48");
  });

  test("bob easy parses format7 Dec 2025 statement", () => {
    const parser = getParser("bob", "easy");
    const text = readFixture("bob", "easy", "format7.txt");
    const rows = parser.parse(text, "2025-12.pdf");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.description).toBe("SWIGGY");
    expect(rows[0]?.debited).toBe("794.00");
    expect(rows[0]?.refNo).toBe("R00976");
  });

  test("bob easy parses BBPS-PAYMENT lines", () => {
    const parser = getParser("bob", "easy");
    const text = readFixture("bob", "easy", "format5.txt");
    const rows = parser.parse(text, "2024-10.pdf");
    const bbps = rows.filter((row) => row.description === "BBPS-PAYMENT");
    expect(bbps).toHaveLength(2);
    expect(bbps[0]?.credited).toBe("1004.00");
    expect(bbps[1]?.credited).toBe("12231.00");
  });

  test("bob easy parses format fixtures", () => {
    const parser = getParser("bob", "easy");
    const cases: Array<{ file: string; minRows: number }> = [
      { file: "format1.txt", minRows: 3 },
      { file: "format2.txt", minRows: 2 },
      { file: "format3.txt", minRows: 2 },
      { file: "format4.txt", minRows: 5 },
      { file: "format5.txt", minRows: 2 },
      { file: "format6.txt", minRows: 3 },
      { file: "format7.txt", minRows: 1 },
    ];
    for (const { file, minRows } of cases) {
      const text = readFixture("bob", "easy", file);
      const rows = parser.parse(text, "statement.pdf");
      expect(rows.length).toBeGreaterThanOrEqual(minRows);
    }
  });

  const format1Smoke: Array<{ bank: string; variant?: string; minRows?: number }> = [
    { bank: "onecard", variant: "default", minRows: 1 },
    { bank: "yes", variant: "ace", minRows: 1 },
    { bank: "csb", variant: "edge", minRows: 1 },
    { bank: "hdfc", variant: "regalia", minRows: 1 },
    { bank: "hdfc", variant: "diners-privilege", minRows: 1 },
    { bank: "hdfc", variant: "swiggy", minRows: 1 },
    { bank: "icici", variant: "coral", minRows: 1 },
    { bank: "icici", variant: "platinum", minRows: 1 },
    { bank: "idfc", variant: "wow", minRows: 0 },
    { bank: "indusind", variant: "auraedge", minRows: 1 },
    { bank: "indusind", variant: "amex-epay", minRows: 1 },
  ];

  for (const { bank, variant, minRows = 1 } of format1Smoke) {
    test(`${bank}/${variant ?? "default"} parses format1`, () => {
      const parser = getParser(bank, variant);
      const parts = variant ? [bank, variant, "format1.txt"] : [bank, "default", "format1.txt"];
      const text = readFixture(...parts);
      const rows = parser.parse(text, "statement.pdf");
      expect(rows.length).toBeGreaterThanOrEqual(minRows);
    });
  }
});
