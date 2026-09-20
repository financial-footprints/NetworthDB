import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Account } from "@core/domains/account/entities/account";
import { buildAccountMetadata } from "@statements/pipeline/stages/metadata/build";
import { statementRelativePath, transactionsCsvRelative } from "@statements/storage/vault/path";
import { VaultStore } from "@statements/storage/vault/store";

describe("buildAccountMetadata csv periods", () => {
  let tenantRoot = "";

  afterEach(() => {
    if (tenantRoot) {
      rmSync(tenantRoot, { recursive: true, force: true });
      tenantRoot = "";
    }
  });

  test("includes a statement csv and a transactions csv with no pdf", () => {
    tenantRoot = mkdtempSync(join(tmpdir(), "ndb-meta-csv-"));
    const store = new VaultStore({ tenantRoot, encryptAtRest: false, dataKey: null });
    const account = Account.create({
      userId: "user-1",
      accountType: "credit_card",
      bank: "bob",
      variant: "easy",
      openingDate: "2020-01-01",
      accountNumber: "fixture",
      passwords: [],
    });

    store.writeBytes(
      statementRelativePath(account.accountType, account.id, "2024-01", "csv"),
      Buffer.from("statement,csv\n")
    );
    store.writeBytes(
      transactionsCsvRelative(account.accountType, account.id, "2024-02"),
      Buffer.from("Date,Description,Ref,Credited,Debited,File\n")
    );

    const metadata = buildAccountMetadata(store, account, null, []);
    const dates = metadata.statements.map((statement) => statement.statement_date);

    expect(dates).toEqual(["2024-01", "2024-02"]);
    expect(metadata.statements[0]?.formats).toContain("csv");
    expect(metadata.statements[1]?.formats).toContain("transactions");
  });
});
