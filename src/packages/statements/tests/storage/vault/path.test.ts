import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  statementRelativePath,
  transactionsCsvRelative,
  uniquePath,
} from "@statements/storage/vault/path";

const ACCOUNT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("vault path helpers", () => {
  let tempDir = "";

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  test("statementRelativePath uses account UUID and FY folder", () => {
    expect(statementRelativePath("credit_card", ACCOUNT_ID, "2024-01", "pdf")).toBe(
      `FY23-2024/credit_card/${ACCOUNT_ID}/2024-01.pdf`
    );
    expect(statementRelativePath("credit_card", ACCOUNT_ID, "FY24-2025", "pdf")).toBe(
      `FY24-2025/credit_card/${ACCOUNT_ID}/2025.pdf`
    );
  });

  test("transactionsCsvRelative", () => {
    expect(transactionsCsvRelative("credit_card", ACCOUNT_ID, "2024-01")).toBe(
      `FY23-2024/credit_card/${ACCOUNT_ID}/transactions-2024-01.csv`
    );
  });

  test("uniquePath appends collision suffix", () => {
    tempDir = mkdtempSync(join(tmpdir(), "ndb-path-test-"));
    writeFileSync(join(tempDir, "2024-01.pdf"), "existing");

    const resolved = uniquePath(tempDir, "2024-01.pdf");
    expect(resolved).toBe(join(tempDir, "2024-01 (1).pdf"));
  });
});
