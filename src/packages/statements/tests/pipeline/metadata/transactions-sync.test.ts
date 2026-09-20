import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Account } from "@core/domains/account/entities/account";
import { EntityNotFoundError } from "@ndb/core";
import type {
  StatementMetadata,
  StoredAccountMetadata,
} from "@statements/pipeline/stages/metadata/stored";
import {
  forceTransactionsUnsynced,
  mergePreservedTransactionsSync,
  setTransactionsSyncForPeriod,
} from "@statements/pipeline/stages/metadata/transactions-sync";
import { statementListFromStored } from "@statements/storage/read/metadata";
import { accountMetadataRelative } from "@statements/storage/vault/path";
import { VaultStore } from "@statements/storage/vault/store";

function sampleAccount(): Account {
  return Account.create({
    userId: "user-1",
    accountType: "credit_card",
    bank: "bob",
    variant: "easy",
    openingDate: "2020-01-01",
    accountNumber: "fixture",
    passwords: [],
  });
}

function emptyStore(): VaultStore {
  const tenantRoot = mkdtempSync(join(tmpdir(), "ndb-meta-read-"));
  return new VaultStore({ tenantRoot, encryptAtRest: false, dataKey: null });
}

function sampleStatement(statementDate: string): StatementMetadata {
  return {
    statement_date: statementDate,
    formats: ["pdf", "txt"],
    opening_balance: "0.00",
    closing_balance: "100.00",
    period_start: "2024-01-01",
    period_end: "2024-01-31",
    period_approximate: false,
    granularity: "monthly",
    covered_months: ["2024-01"],
    year_key: null,
    transactions_synced: false,
    transactions_import_id: null,
  };
}

function sampleStoredMetadata(statements: StatementMetadata[]): StoredAccountMetadata {
  const statementDates = statements.map((row) => row.statement_date);
  return {
    account_id: "acct-1",
    bank: "bob",
    variant: "easy",
    account_type: "credit_card",
    opening_date: "2020-01-01",
    closing_date: null,
    formats: ["pdf", "txt"],
    statements,
    statement_dates: statementDates,
    starting: statementDates[0] ?? null,
    ending: statementDates.at(-1) ?? null,
    statement_count: statementDates.length,
    period_covered: {
      start: statementDates[0] ?? null,
      end: statementDates.at(-1) ?? null,
      segments: [],
      gaps: [],
      months: ["2024-01"],
      period_count: statementDates.length,
    },
  };
}

describe("mergePreservedTransactionsSync", () => {
  test("treats last_fetch_date-only previous as no prior metadata", () => {
    const current = sampleStoredMetadata([sampleStatement("2024-01")]);
    const previous = { last_fetch_date: "04-10-2026" } as StoredAccountMetadata;

    const merged = mergePreservedTransactionsSync(current, previous);

    expect(merged.statements).toHaveLength(1);
    expect(merged.statements[0]?.transactions_synced).toBe(false);
    expect(merged.statements[0]?.transactions_import_id).toBeNull();
  });

  test("preserves transactions sync flags from full previous metadata", () => {
    const priorStatement = sampleStatement("2024-01");
    priorStatement.transactions_synced = true;
    priorStatement.transactions_import_id = "import-1";

    const previous = sampleStoredMetadata([priorStatement]);
    const current = sampleStoredMetadata([
      {
        ...sampleStatement("2024-01"),
        closing_balance: "200.00",
      },
    ]);

    const merged = mergePreservedTransactionsSync(current, previous);

    expect(merged.statements[0]?.closing_balance).toBe("200.00");
    expect(merged.statements[0]?.transactions_synced).toBe(true);
    expect(merged.statements[0]?.transactions_import_id).toBe("import-1");

    const forced = forceTransactionsUnsynced(merged, ["2024-01"]);
    expect(forced.statements[0]?.transactions_synced).toBe(false);
    expect(forced.statements[0]?.transactions_import_id).toBe("import-1");
  });
});

describe("statementListFromStored", () => {
  test("returns unavailable for last_fetch_date-only stub", () => {
    const stub = { last_fetch_date: "04-10-2026" } as StoredAccountMetadata;
    const store = emptyStore();
    const list = statementListFromStored(stub, sampleAccount(), store);

    expect(list.available).toBe(false);
    expect(list.statements).toHaveLength(0);
  });
});

function writeStoredMetadata(
  store: VaultStore,
  account: Account,
  metadata: StoredAccountMetadata
): void {
  const relative = accountMetadataRelative(account.accountType, account.id);
  store.writeBytes(relative, Buffer.from(JSON.stringify(metadata, null, 2)));
}

describe("setTransactionsSyncForPeriod", () => {
  test("throws EntityNotFoundError when metadata is missing", () => {
    const store = emptyStore();
    const account = sampleAccount();

    expect(() => setTransactionsSyncForPeriod(store, account, "2024-01", true, null)).toThrow(
      EntityNotFoundError
    );
  });

  test("throws EntityNotFoundError when statement period is absent", () => {
    const store = emptyStore();
    const account = sampleAccount();
    writeStoredMetadata(store, account, sampleStoredMetadata([sampleStatement("2024-01")]));

    expect(() => setTransactionsSyncForPeriod(store, account, "2024-06", true, null)).toThrow(
      EntityNotFoundError
    );
  });
});
