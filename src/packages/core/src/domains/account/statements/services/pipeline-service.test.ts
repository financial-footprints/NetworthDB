import { beforeAll, describe, expect, test } from "bun:test";
import { AccountService } from "@core/domains/account/services/account-service";
import { PipelineService } from "@core/domains/account/statements/services/pipeline-service";
import type { StatementList } from "@core/domains/account/statements/types";
import { LedgerIngestService } from "@core/domains/account/transactions/services/ledger-ingest-service";
import { TransactionService } from "@core/domains/account/transactions/services/transaction-service";
import { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import { SourcesService } from "@core/domains/sources/services/sources-service";
import { User, Username } from "@core/domains/user/entities/user/index";
import type { StatementEngine } from "@core/ports/statement-engine";
import { ValidationError } from "@core/shared/errors/domain-error";
import { InMemoryAccountRepository } from "@core/tests/fakes/in-memory-account-repository";
import { InMemoryCategoryRepository } from "@core/tests/fakes/in-memory-category-repository";
import { InMemoryJobRepository } from "@core/tests/fakes/in-memory-job-repository";
import { InMemorySourcesRepository } from "@core/tests/fakes/in-memory-sources-repository";
import { InMemoryTagRepository } from "@core/tests/fakes/in-memory-tag-repository";
import { InMemoryUserRepository } from "@core/tests/fakes/in-memory-user-repository";
import { nullUserDataKeyLoader } from "@core/tests/fakes/null-user-data-key-loader";

const ACCOUNT_NUMBER_SAMPLE = "abc.def";

describe("PipelineService", () => {
  let actor: User;
  let account: AccountService;
  let sources: SourcesService;
  let jobRepository: InMemoryJobRepository;
  let service: PipelineService;
  let accountId: string;

  beforeAll(async () => {
    const mockEngine: StatementEngine = {
      listBanks: () => [],
      async processPipeline() {
        return { ok: true, warnings: [] };
      },
      async processUpload() {
        return { ok: true, warnings: [] };
      },
      readAccountStatements() {
        return {
          available: false,
          statementCount: 0,
          formats: [],
          coverage: { segments: [], gaps: [], months: [], periodCount: 0 },
          statements: [],
          balanceGaps: [],
        };
      },
      readStatementFile() {
        return null;
      },
      statementFileExists() {
        return false;
      },
      async writeUpload() {
        return { relative: "in-memory/upload" };
      },
      async deleteAccountStatements() {
        return { ok: true, warnings: [] };
      },
      setTransactionsSync() {},
    };

    const users = new InMemoryUserRepository();
    const passwordHash = "stub-password-hash";
    const user = await users.create(
      new User(
        crypto.randomUUID(),
        Username.parse("alice"),
        passwordHash,
        "user",
        false,
        new Date()
      )
    );

    actor = user;
    const accountRepository = new InMemoryAccountRepository();
    sources = new SourcesService(new InMemorySourcesRepository());
    jobRepository = new InMemoryJobRepository();
    const runner = new JobRunnerService(jobRepository, 1);
    const statements = { engine: mockEngine, trace: false };
    account = new AccountService(
      accountRepository,
      sources,
      runner,
      nullUserDataKeyLoader,
      statements
    );
    service = new PipelineService(
      accountRepository,
      sources,
      runner,
      nullUserDataKeyLoader,
      statements
    );

    const created = await account.create(actor, "aal1", {
      bank: "onecard",
      accountType: "credit_card",
      openingDate: "2020-01-15",
      accountNumber: ACCOUNT_NUMBER_SAMPLE,
      passwords: [],
    });
    accountId = created.id;
  });

  test("sync rejects when account id is missing", async () => {
    await expect(service.sync(actor, "aal1", { accountId: "" })).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  test("sync rejects when no sources configured", async () => {
    await expect(service.sync(actor, "aal1", { accountId })).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  test("sync enqueues completed job when engine succeeds", async () => {
    await sources.updateSources(actor, "aal1", {
      sources: [
        {
          id: "email-1",
          type: "email",
          label: "Inbox",
          host: "imap.example.com",
          port: 993,
          username: "user",
          password: "secret",
          folder: "INBOX",
          useSsl: true,
        },
      ],
    });

    const result = await service.sync(actor, "aal1", { accountId });
    await Bun.sleep(30);

    const job = await jobRepository.findById(actor.id, result.jobId);
    expect(job?.status).toBe("completed");
  });
});

const LEDGER_CSV = `Date,Description,Ref,Credited,Debited,File
2024-01-15,Coffee shop,,0.00,10.00,2024-01.pdf
`;

describe("PipelineService ledger ingest", () => {
  test("sync inserts an unsynced transactions csv for the account", async () => {
    const users = new InMemoryUserRepository();
    const actor = await users.create(
      new User(
        crypto.randomUUID(),
        Username.parse("ledger_sync"),
        "stub-password-hash",
        "user",
        false,
        new Date()
      )
    );
    const accountRepository = new InMemoryAccountRepository();
    const sources = new SourcesService(new InMemorySourcesRepository());
    const jobRepository = new InMemoryJobRepository();
    const runner = new JobRunnerService(jobRepository, 1);
    let synced = false;
    let ledgerAccountId = "";

    const engine: StatementEngine = {
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
              accountId: ledgerAccountId,
              kind: "monthly",
              period: "2023-12",
              statementDate: "2024-01",
              formats: ["transactions"],
              periodStart: "2024-01-01",
              periodEnd: "2024-01-31",
              transactionsSynced: synced,
              transactionsImportId: null,
            },
          ],
          balanceGaps: [],
        };
      },
      readStatementFile(input) {
        if (input.format === "transactions" && input.statementDate === "2024-01") {
          return Buffer.from(LEDGER_CSV, "utf8");
        }
        return null;
      },
      statementFileExists() {
        return false;
      },
      async writeUpload() {
        return { relative: "in-memory/upload" };
      },
      async deleteAccountStatements() {
        return { ok: true, warnings: [] };
      },
      setTransactionsSync(input) {
        synced = input.transactionsSynced;
      },
    };

    const statements = { engine, trace: false };
    const account = new AccountService(
      accountRepository,
      sources,
      runner,
      nullUserDataKeyLoader,
      statements
    );
    const transactions = new TransactionService(
      accountRepository.transactions,
      accountRepository,
      new InMemoryCategoryRepository(),
      new InMemoryTagRepository(),
      account
    );
    const ingest = new LedgerIngestService(
      statements,
      nullUserDataKeyLoader,
      account,
      accountRepository,
      transactions
    );
    account.attachLedgerIngest(ingest);

    const created = await account.create(actor, "aal1", {
      bank: "onecard",
      accountType: "credit_card",
      openingDate: "2020-01-15",
      accountNumber: ACCOUNT_NUMBER_SAMPLE,
      passwords: [],
    });
    ledgerAccountId = created.id;
    await sources.updateSources(actor, "aal1", {
      sources: [
        {
          id: "email-1",
          type: "email",
          label: "Inbox",
          host: "imap.example.com",
          port: 993,
          username: "user",
          password: "secret",
          folder: "INBOX",
          useSsl: true,
        },
      ],
    });

    const result = await account.pipeline.sync(actor, "aal1", { accountId: created.id });
    await Bun.sleep(50);

    const job = await jobRepository.findById(actor.id, result.jobId);
    expect(job?.status).toBe("completed");
    expect(synced).toBe(true);

    const { total, items } = await transactions.listInRange(actor, "aal1", created.id, {
      from: "2024-01-01",
      to: "2024-01-31",
    });
    expect(total).toBe(1);
    expect(items[0]?.description).toBe("Coffee shop");
    expect(items[0]?.sourceAccountId).toBe(created.id);
  });
});
