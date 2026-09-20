import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BobEasyHandler } from "@statements/banks/institutions/bob/easy/handler";

const FIXTURES_ROOT = join(import.meta.dir, "..", "..", "fixtures");

function readFixture(...parts: string[]): string {
  return readFileSync(join(FIXTURES_ROOT, ...parts), "utf8");
}

describe("bob cleanText multi-page", () => {
  test("single-page mashed format1 parses transactions", () => {
    const raw = readFixture("bob", "easy", "format1.txt");
    const cleaned = BobEasyHandler.cleanText(raw);
    expect(cleaned).toContain("UPI-ZOMATO");
    expect(cleaned).not.toMatch(/\bPage\s+\d+\s+of\s+\d+\b/);
  });

  test("multi-page extract keeps transactions after page 1 footer", () => {
    const raw = [
      "Credit Card Monthly Statement",
      "Transaction Details",
      "Date Ref. No. Particulars",
      "Chetan Goswamy",
      "Page 1 of 4",
      "Reward Summary at Card Level",
      "",
      "AJAY TRIPATHI (PRIMARY CARD - 6736)",
      "18/08/2024 R92485 SIGNAL FOUNDATION 840 0 INR 200.00 200.00 DR",
      "Page 2 of 4",
    ].join("\n");
    const cleaned = BobEasyHandler.cleanText(raw);
    expect(cleaned).toContain("18/08/2024 R92485 SIGNAL FOUNDATION");
    expect(cleaned).not.toMatch(/\bPage\s+\d+\s+of\s+\d+\b/);
    expect(cleaned).not.toContain("Reward Summary at Card Level");
  });
});
