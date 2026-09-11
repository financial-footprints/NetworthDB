import { describe, expect, test } from "bun:test";
import {
  backupEntryToWritePayload,
  buildBackupFiles,
  findExistingAccountId,
  parseBackupAccountsJson,
  sourcesToWritePayload,
} from "@web/utils/accounts/backup";
import type { Account } from "@web/utils/api/endpoints/accounts/types";

const existingAccount: Account = {
  id: "11111111-1111-4111-8111-111111111111",
  label: "OneCard",
  bank: "onecard",
  variant: null,
  account_type: "credit_card",
  opening_date: "2020-01-15",
  closing_date: null,
  account_number: "5678",
  has_passwords: true,
};

describe("backup", () => {
  test("backupEntryToWritePayload maps API account shape", () => {
    const payload = backupEntryToWritePayload({
      ...existingAccount,
      passwords: ["secret"],
    });

    expect(payload.bank).toBe("onecard");
    expect(payload.account_number).toBe("5678");
    expect(payload.passwords).toEqual(["secret"]);
    expect(payload.type).toBe("credit_card");
  });

  test("buildBackupFiles writes accounts.json from API data", () => {
    const files = buildBackupFiles([existingAccount], []);
    const parsed = JSON.parse(files["accounts.json"]) as Array<Record<string, unknown>>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.account_number).toBe("5678");
  });

  test("parseBackupAccountsJson validates exported accounts", () => {
    const files = buildBackupFiles([existingAccount], []);
    const accounts = parseBackupAccountsJson(files["accounts.json"]);
    expect(accounts[0]?.bank).toBe("onecard");
  });

  test("findExistingAccountId matches by account number", () => {
    const usedIds = new Set<string>();
    const id = findExistingAccountId(
      {
        bank: "onecard",
        account_type: "credit_card",
        opening_date: "2020-01-15",
        account_number: "5678",
      },
      [existingAccount],
      usedIds
    );
    expect(id).toBe(existingAccount.id);
  });

  test("sourcesToWritePayload maps email password", () => {
    const writes = sourcesToWritePayload([
      {
        id: "email-1",
        type: "email",
        label: "Work",
        host: "imap.example.test",
        port: 993,
        username: "user@example.test",
        folder: "INBOX",
        use_ssl: true,
        has_password: true,
        password: "imap-secret",
      },
    ]);

    expect(writes[0]).toMatchObject({
      password: "imap-secret",
      host: "imap.example.test",
    });
  });
});
