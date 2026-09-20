import { beforeAll, describe, expect, test } from "bun:test";
import { Account } from "@core/domains/account/entities/account";
import { AccountService } from "@core/domains/account/services/account-service";
import type { StatementList } from "@core/domains/account/statements/types";
import { LedgerIngestService } from "@core/domains/account/transactions/services/ledger-ingest-service";
import { TransactionService } from "@core/domains/account/transactions/services/transaction-service";
import { parseTransactionsCsv } from "@core/domains/account/transactions/services/vault-csv";
import { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import { SourcesService } from "@core/domains/sources/services/sources-service";
import { User, Username } from "@core/domains/user/entities/user/index";
import type { StatementEngine } from "@core/ports/statement-engine";
import { InMemoryAccountRepository } from "@core/tests/fakes/in-memory-account-repository";
import { InMemoryCategoryRepository } from "@core/tests/fakes/in-memory-category-repository";
import { InMemoryJobRepository } from "@core/tests/fakes/in-memory-job-repository";
import { InMemorySourcesRepository } from "@core/tests/fakes/in-memory-sources-repository";
import { InMemoryTagRepository } from "@core/tests/fakes/in-memory-tag-repository";
import { nullUserDataKeyLoader } from "@core/tests/fakes/null-user-data-key-loader";

const SAMPLE_CSV = `date,description,ref,credited,debited
2024-01-15,Coffee shop,,0.00,10.00`;

describe("LedgerIngestService", () => {
  let user: User;
  let bank: Account;
  let unknownId: string;
  let accountService: AccountService;
  let transactionService: TransactionService;
  let ingest: LedgerIngestService;
  const accounts = new InMemoryAccountRepository();
  const transactions = accounts.transactions;

  const syncCalls: Array<{
    period: string;
    transactionsSynced: boolean;
    transactionsImportId: string | null;
  }> = [];

  let periodSynced = false;
  let periodImportId: string | null = null;
  let csvPayload = SAMPLE_CSV;

  const mockEngine: StatementEngine = {
    listBanks: () => [],
    async processPipeline() {
      return { ok: true, warnings: [] };
    },
    async processUpload() {
      return { ok: true, warnings: [] };
    },
    readAccountStatements(): StatementList {
      return {
        available: true,
        statementCount: 1,
        formats: ["transactions"],
        coverage: { segments: [], gaps: [], months: [], periodCount: 1 },
        statements: [
          {
            accountId: bank.id,
            kind: "monthly",
            period: "2023-12",
            statementDate: "2024-01",
            formats: ["transactions"],
            periodStart: "2024-01-01",
            periodEnd: "2024-01-31",
            transactionsSynced: periodSynced,
            transactionsImportId: periodImportId,
          },
        ],
        balanceGaps: [],
      };
    },
    readStatementFile(input) {
      if (input.format === "transactions" && input.statementDate === "2024-01") {
        return Buffer.from(csvPayload, "utf8");
      }
      return null;
    },
    statementFileExists() {
      return false;
    },
    async writeUpload() {
      return { relative: "test/upload" };
    },
    async deleteAccountStatements() {
      return { ok: true, warnings: [] };
    },
    setTransactionsSync(input) {
      syncCalls.push({
        period: input.period,
        transactionsSynced: input.transactionsSynced,
        transactionsImportId: input.transactionsImportId,
      });
      periodSynced = input.transactionsSynced;
      periodImportId = input.transactionsImportId;
    },
  };

  beforeAll(async () => {
    user = new User(
      crypto.randomUUID(),
      Username.parse("ingest_user"),
      "hash",
      "user",
      true,
      new Date()
    );
    bank = Account.create({
      userId: user.id,
      accountType: "bank",
      bank: "HDFC",
      openingDate: "2020-01-01",
      accountNumber: "1234567890",
      passwords: [],
    });
    await accounts.create(bank);

    accountService = new AccountService(
      accounts,
      new SourcesService(new InMemorySourcesRepository()),
      new JobRunnerService(new InMemoryJobRepository(), 1),
      nullUserDataKeyLoader,
      { engine: mockEngine, trace: false }
    );
    await accountService.ensureSystemAccounts(user.id);
    const system = await accountService.listSystemAccounts(user, "aal2");
    unknownId = system.find((item) => item.accountType === "unknown")?.id ?? "";

    transactionService = new TransactionService(
      transactions,
      accounts,
      new InMemoryCategoryRepository(),
      new InMemoryTagRepository(),
      accountService
    );

    ingest = new LedgerIngestService(
      { engine: mockEngine, trace: false },
      nullUserDataKeyLoader,
      accountService,
      accounts,
      transactionService
    );
  });

  test("parseTransactionsCsv handles quoted commas in description", () => {
    const rows = parseTransactionsCsv(
      'date,description,ref,credited,debited\n2024-01-15,"Coffee, tea",,0.00,10.00'
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.description).toBe("Coffee, tea");
  });

  test("ingest creates debit transaction with Unknown counterpart", async () => {
    syncCalls.length = 0;
    periodSynced = false;
    periodImportId = null;
    csvPayload = SAMPLE_CSV;

    await ingest.ingestUnsyncedForAccount(user.id, bank, () => false);

    const { items, total } = await transactionService.listInRange(user, "aal2", bank.id, {
      from: "2024-01-01",
      to: "2024-01-31",
    });
    expect(total).toBe(1);
    expect(items[0]?.amount).toBe(1000);
    expect(items[0]?.description).toBe("Coffee shop");
    expect(items[0]?.sourceAccountId).toBe(bank.id);
    expect(items[0]?.destinationAccountId).toBe(unknownId);
  });

  test("setTransactionsSync marks period synced with import id", async () => {
    expect(syncCalls.some((call) => call.period === "2024-01")).toBe(true);
    const last = syncCalls.filter((call) => call.period === "2024-01").at(-1);
    expect(last?.transactionsSynced).toBe(true);
    expect(last?.transactionsImportId).toBeString();
  });

  test("re-ingest replaces import without duplicating rows", async () => {
    const before = await transactionService.listInRange(user, "aal2", bank.id, {
      from: "2024-01-01",
      to: "2024-01-31",
    });
    expect(before.total).toBe(1);
    const priorImportId = before.items[0]?.importId ?? null;

    periodSynced = false;
    periodImportId = priorImportId;
    csvPayload = SAMPLE_CSV;

    await ingest.ingestUnsyncedForAccount(user.id, bank, () => false);

    const after = await transactionService.listInRange(user, "aal2", bank.id, {
      from: "2024-01-01",
      to: "2024-01-31",
    });
    expect(after.total).toBe(1);
  });

  test("header-only CSV syncs with null import and no transactions", async () => {
    const current = await transactionService.listInRange(user, "aal2", bank.id, {
      from: "2024-01-01",
      to: "2024-01-31",
    });
    periodImportId = current.items[0]?.importId ?? null;
    syncCalls.length = 0;
    periodSynced = false;
    csvPayload = "date,description,ref,credited,debited";

    await ingest.ingestUnsyncedForAccount(user.id, bank, () => false);

    const { total } = await transactionService.listInRange(user, "aal2", bank.id, {
      from: "2024-01-01",
      to: "2024-01-31",
    });
    expect(total).toBe(0);
    const last = syncCalls.filter((call) => call.period === "2024-01").at(-1);
    expect(last?.transactionsSynced).toBe(true);
    expect(last?.transactionsImportId).toBeNull();
  });
});
