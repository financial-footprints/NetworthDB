import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  statementFormatsFromVault,
  unionStatementFormats,
} from "@statements/storage/vault/statement-formats";
import { VaultStore } from "@statements/storage/vault/store";

const ACCOUNT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("statementFormatsFromVault", () => {
  let tenantRoot = "";

  afterEach(() => {
    if (tenantRoot) {
      rmSync(tenantRoot, { recursive: true, force: true });
      tenantRoot = "";
    }
  });

  function openStore(): VaultStore {
    tenantRoot = mkdtempSync(join(tmpdir(), "ndb-formats-"));
    return new VaultStore({
      tenantRoot,
      encryptAtRest: false,
      dataKey: null,
    });
  }

  test("lists pdf, txt, and transactions independently", () => {
    const store = openStore();
    store.writeBytes(`FY23-2024/credit_card/${ACCOUNT_ID}/2024-01.pdf`, Buffer.from("pdf"));
    store.writeBytes(`FY23-2024/credit_card/${ACCOUNT_ID}/2024-01.txt`, Buffer.from("txt"));
    store.writeBytes(
      `FY23-2024/credit_card/${ACCOUNT_ID}/transactions-2024-01.csv`,
      Buffer.from("tx")
    );

    expect(statementFormatsFromVault(store, "credit_card", ACCOUNT_ID, "2024-01")).toEqual([
      "pdf",
      "txt",
      "transactions",
    ]);
  });

  test("unionStatementFormats merges statement format lists", () => {
    expect(
      unionStatementFormats([{ formats: ["pdf", "txt"] }, { formats: ["pdf", "transactions"] }])
    ).toEqual(["pdf", "txt", "transactions"]);
  });
});
