import { describe, expect, test } from "bun:test";
import { formatBackupImportMessage } from "@web/utils/accounts";

describe("backup helpers", () => {
  test("formatBackupImportMessage uses zero for missing counts", () => {
    expect(formatBackupImportMessage(undefined)).toBe(
      "Restored backup: 0 account(s) created, 0 updated, 0 transaction(s) inserted, 0 skipped."
    );
  });

  test("formatBackupImportMessage formats job output counts", () => {
    expect(
      formatBackupImportMessage({
        accountsCreated: 2,
        accountsUpdated: 1,
        transactionsInserted: 100,
        transactionsSkipped: 5,
      })
    ).toBe(
      "Restored backup: 2 account(s) created, 1 updated, 100 transaction(s) inserted, 5 skipped."
    );
  });
});
