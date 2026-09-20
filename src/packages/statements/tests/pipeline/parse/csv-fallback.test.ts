import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Account } from "@core/domains/account/entities/account";
import { PipelineRun } from "@core/domains/account/statements/entities/pipeline";
import type { StatementsEngineConfig } from "@statements/config/runtime";
import { openVaultStore } from "@statements/config/runtime";
import type { PreparedStatement } from "@statements/pipeline/stages/cleanup/models";
import { runParse } from "@statements/pipeline/stages/parse/index";
import { statementRelativePath, transactionsCsvRelative } from "@statements/storage/vault/path";

const BOB_ROW = "01/01/2024 REF123 Coffee INR 1.00 10.00 DR";

describe("runParse csv rows", () => {
  let filestorePath = "";

  afterEach(() => {
    if (filestorePath) {
      rmSync(filestorePath, { recursive: true, force: true });
      filestorePath = "";
    }
  });

  function config(): StatementsEngineConfig {
    filestorePath = mkdtempSync(join(tmpdir(), "ndb-parse-csv-"));
    return {
      filestorePath,
      encryptAtRest: false,
      logLevel: "info",
      environment: "local",
    };
  }

  function pipeline(): PipelineRun {
    const account = Account.create({
      userId: "user-1",
      accountType: "credit_card",
      bank: "bob",
      variant: "easy",
      openingDate: "2020-01-01",
      accountNumber: "fixture",
      passwords: [],
    });
    return PipelineRun.createSync({
      jobId: "job-1",
      userId: account.userId,
      account,
      sources: [],
      financialYear: null,
      dataKey: null,
      trace: false,
    });
  }

  test("csv rows replace an empty pdf parse for the same period", async () => {
    const engineConfig = config();
    const run = pipeline();
    const prepared: PreparedStatement[] = [
      {
        period: "2024-01",
        cleanedText: "statement summary only",
        pdfBytes: Buffer.from("pdf"),
        sourceCsv: null,
      },
      {
        period: "2024-01",
        cleanedText: BOB_ROW,
        pdfBytes: null,
        sourceCsv: Buffer.from(BOB_ROW),
      },
    ];

    const result = await runParse(run, engineConfig, prepared);
    const store = openVaultStore(engineConfig, run.userId, null);
    const written = store.readBytes(
      transactionsCsvRelative(run.account.accountType, run.account.id, "2024-01")
    );

    expect(result.rowCount).toBe(1);
    expect(written?.toString("utf8")).toContain("Coffee");
  });

  test("parses a statement csv already stored in the vault", async () => {
    const engineConfig = config();
    const run = pipeline();
    const store = openVaultStore(engineConfig, run.userId, null);
    store.writeBytes(
      statementRelativePath(run.account.accountType, run.account.id, "2024-02", "csv"),
      Buffer.from(BOB_ROW)
    );

    const result = await runParse(run, engineConfig, []);
    const written = store.readBytes(
      transactionsCsvRelative(run.account.accountType, run.account.id, "2024-02")
    );

    expect(result.parsedPeriods).toContain("2024-02");
    expect(result.rowCount).toBe(1);
    expect(written?.toString("utf8")).toContain("Coffee");
  });
});
