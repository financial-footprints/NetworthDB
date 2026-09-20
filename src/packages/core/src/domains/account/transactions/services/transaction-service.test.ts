import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Account } from "@core/domains/account/entities/account";
import { AccountService } from "@core/domains/account/services/account-service";
import { TransactionService } from "@core/domains/account/transactions/services/transaction-service";
import { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import { SourcesService } from "@core/domains/sources/services/sources-service";
import { User, Username } from "@core/domains/user/entities/user/index";
import { EntityNotFoundError, ValidationError } from "@core/shared/errors/domain-error";
import { InMemoryAccountRepository } from "@core/tests/fakes/in-memory-account-repository";
import { InMemoryCategoryRepository } from "@core/tests/fakes/in-memory-category-repository";
import { InMemoryJobRepository } from "@core/tests/fakes/in-memory-job-repository";
import { InMemorySourcesRepository } from "@core/tests/fakes/in-memory-sources-repository";
import { InMemoryTagRepository } from "@core/tests/fakes/in-memory-tag-repository";
import { nullUserDataKeyLoader } from "@core/tests/fakes/null-user-data-key-loader";
import {
  shutdownTestStatementsEngine,
  testStatementsServices,
} from "@tests/bootstrap/helpers/statements-compute";

const AAL2 = "aal2";

describe("TransactionService", () => {
  let user: User;
  let account: Account;
  let other: Account;
  let unknownId: string;
  let expenseId: string;
  let tumblerId: string;
  let service: TransactionService;
  const accounts = new InMemoryAccountRepository();
  const transactions = accounts.transactions;

  beforeAll(async () => {
    user = new User(
      crypto.randomUUID(),
      Username.parse("ledger_user"),
      "hash",
      "user",
      true,
      new Date()
    );
    account = Account.create({
      userId: user.id,
      accountType: "bank",
      bank: "HDFC",
      openingDate: "2020-01-01",
      accountNumber: "1234567890",
      passwords: [],
    });
    other = Account.create({
      userId: user.id,
      accountType: "loan",
      bank: "HomeLoan",
      openingDate: "2020-01-01",
      accountNumber: "loan-1",
      passwords: [],
    });
    await accounts.create(account);
    await accounts.create(other);
    const accountService = new AccountService(
      accounts,
      new SourcesService(new InMemorySourcesRepository()),
      new JobRunnerService(new InMemoryJobRepository(), 1),
      nullUserDataKeyLoader,
      testStatementsServices()
    );
    await accountService.ensureSystemAccounts(user.id);
    const system = await accountService.listSystemAccounts(user, AAL2);
    unknownId = system.find((item) => item.accountType === "unknown")?.id ?? "";
    expenseId = system.find((item) => item.accountType === "expense")?.id ?? "";
    tumblerId = system.find((item) => item.accountType === "tumbler")?.id ?? "";
    service = new TransactionService(
      transactions,
      accounts,
      new InMemoryCategoryRepository(),
      new InMemoryTagRepository(),
      accountService
    );
  });

  afterAll(async () => {
    await shutdownTestStatementsEngine();
  });

  test("balanceAsOf across two months", async () => {
    await service.create(user, AAL2, account.id, {
      date: "2024-01-15",
      amount: 10000,
      sourceAccountId: unknownId,
      destinationAccountId: account.id,
      description: "Coffee shop",
    });
    await service.create(user, AAL2, account.id, {
      date: "2024-02-10",
      amount: 2500,
      sourceAccountId: account.id,
      destinationAccountId: unknownId,
      description: "Coffee shop",
    });

    const endJan = await service.balanceAsOf(user, AAL2, account.id, "2024-01-31");
    const midFeb = await service.balanceAsOf(user, AAL2, account.id, "2024-02-15");
    expect(endJan).toBe(10000);
    expect(midFeb).toBe(7500);
  });

  test("transfer appears in both instrument lists", async () => {
    await service.create(user, AAL2, account.id, {
      date: "2024-05-01",
      amount: 400,
      sourceAccountId: account.id,
      destinationAccountId: other.id,
      description: "Coffee shop",
    });
    const fromList = await service.listInRange(user, AAL2, account.id, {
      from: "2024-05-01",
      to: "2024-05-31",
    });
    const toList = await service.listInRange(user, AAL2, other.id, {
      from: "2024-05-01",
      to: "2024-05-31",
    });
    expect(fromList.total).toBeGreaterThanOrEqual(1);
    expect(toList.total).toBeGreaterThanOrEqual(1);
  });

  test("rejects illegal pairs", async () => {
    await expect(
      service.create(user, AAL2, account.id, {
        date: "2024-05-02",
        amount: 100,
        sourceAccountId: expenseId,
        destinationAccountId: account.id,
        description: "Coffee shop",
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("allows tumbler as counterpart", async () => {
    const saved = await service.create(user, AAL2, account.id, {
      date: "2024-05-03",
      amount: 50,
      sourceAccountId: account.id,
      destinationAccountId: tumblerId,
      description: "Coffee shop",
    });
    expect(saved).not.toBeNull();
    if (!saved) {
      throw new Error("expected transaction");
    }
    expect(saved.destinationAccountId).toBe(tumblerId);
  });

  test("patch can reclassify unknown dest to expense", async () => {
    const created = await service.create(user, AAL2, account.id, {
      date: "2024-05-04",
      amount: 75,
      sourceAccountId: account.id,
      destinationAccountId: unknownId,
      description: "Coffee shop",
    });
    if (!created) {
      throw new Error("expected transaction");
    }
    const updated = await service.update(user, AAL2, account.id, created.id, {
      date: "2024-05-04",
      amount: 80,
      sourceAccountId: account.id,
      destinationAccountId: expenseId,
      description: "Coffee shop updated",
      refNo: null,
      categoryId: null,
      subcategoryId: null,
      tagIds: [],
    });
    expect(updated.amount).toBe(80);
    expect(updated.destinationAccountId).toBe(expenseId);
  });

  test("updateMany applies a shared field and a row-only change", async () => {
    const first = await service.create(user, AAL2, account.id, {
      date: "2024-07-01",
      amount: 100,
      sourceAccountId: account.id,
      destinationAccountId: unknownId,
      description: "First shop",
    });
    const second = await service.create(user, AAL2, account.id, {
      date: "2024-07-02",
      amount: 200,
      sourceAccountId: account.id,
      destinationAccountId: unknownId,
      description: "Second shop",
    });
    if (!first || !second) {
      throw new Error("expected transactions");
    }

    const updated = await service.updateMany(user, AAL2, account.id, [
      {
        id: first.id,
        date: first.date,
        amount: first.amount,
        sourceAccountId: account.id,
        destinationAccountId: expenseId,
        description: "First shop edited",
        refNo: null,
        categoryId: null,
        subcategoryId: null,
        tagIds: [],
      },
      {
        id: second.id,
        date: second.date,
        amount: second.amount,
        sourceAccountId: account.id,
        destinationAccountId: expenseId,
        description: second.description,
        refNo: null,
        categoryId: null,
        subcategoryId: null,
        tagIds: [],
      },
    ]);
    expect(updated).toBe(2);

    const savedFirst = await transactions.findById(user.id, first.id);
    const savedSecond = await transactions.findById(user.id, second.id);
    expect(savedFirst?.destinationAccountId).toBe(expenseId);
    expect(savedFirst?.description).toBe("First shop edited");
    expect(savedSecond?.destinationAccountId).toBe(expenseId);
    expect(savedSecond?.description).toBe("Second shop");
  });

  test("updateMany rejects an illegal pair without writing", async () => {
    const created = await service.create(user, AAL2, account.id, {
      date: "2024-07-03",
      amount: 30,
      sourceAccountId: account.id,
      destinationAccountId: unknownId,
      description: "Keep me",
    });
    const otherRow = await service.create(user, AAL2, account.id, {
      date: "2024-07-04",
      amount: 40,
      sourceAccountId: account.id,
      destinationAccountId: unknownId,
      description: "Also keep me",
    });
    if (!created || !otherRow) {
      throw new Error("expected transactions");
    }

    await expect(
      service.updateMany(user, AAL2, account.id, [
        {
          id: otherRow.id,
          date: otherRow.date,
          amount: otherRow.amount,
          sourceAccountId: account.id,
          destinationAccountId: expenseId,
          description: "Should not save",
          refNo: null,
          categoryId: null,
          subcategoryId: null,
          tagIds: [],
        },
        {
          id: created.id,
          date: created.date,
          amount: created.amount,
          sourceAccountId: account.id,
          destinationAccountId: account.id,
          description: "Should not save",
          refNo: null,
          categoryId: null,
          subcategoryId: null,
          tagIds: [],
        },
      ])
    ).rejects.toBeInstanceOf(ValidationError);

    const saved = await transactions.findById(user.id, created.id);
    const savedOther = await transactions.findById(user.id, otherRow.id);
    expect(saved?.description).toBe("Keep me");
    expect(saved?.destinationAccountId).toBe(unknownId);
    expect(savedOther?.description).toBe("Also keep me");
    expect(savedOther?.destinationAccountId).toBe(unknownId);
  });

  test("deleteMany removes two rows and leaves others", async () => {
    const first = await service.create(user, AAL2, account.id, {
      date: "2024-08-01",
      amount: 11,
      sourceAccountId: account.id,
      destinationAccountId: unknownId,
      description: "Delete one",
    });
    const second = await service.create(user, AAL2, account.id, {
      date: "2024-08-02",
      amount: 12,
      sourceAccountId: account.id,
      destinationAccountId: unknownId,
      description: "Delete two",
    });
    const keep = await service.create(user, AAL2, account.id, {
      date: "2024-08-03",
      amount: 13,
      sourceAccountId: account.id,
      destinationAccountId: unknownId,
      description: "Keep this",
    });
    if (!first || !second || !keep) {
      throw new Error("expected transactions");
    }

    const deleted = await service.deleteMany(user, AAL2, account.id, [first.id, second.id]);
    expect(deleted).toBe(2);
    expect(await transactions.findById(user.id, first.id)).toBeNull();
    expect(await transactions.findById(user.id, second.id)).toBeNull();
    expect((await transactions.findById(user.id, keep.id))?.description).toBe("Keep this");
  });

  test("deleteMany rejects an unknown id without deleting the other", async () => {
    const created = await service.create(user, AAL2, account.id, {
      date: "2024-08-04",
      amount: 14,
      sourceAccountId: account.id,
      destinationAccountId: unknownId,
      description: "Still here",
    });
    if (!created) {
      throw new Error("expected transaction");
    }

    await expect(
      service.deleteMany(user, AAL2, account.id, [created.id, crypto.randomUUID()])
    ).rejects.toBeInstanceOf(EntityNotFoundError);

    expect((await transactions.findById(user.id, created.id))?.description).toBe("Still here");
  });

  test("summarizeRange spans month boundary", async () => {
    const summary = await service.summarizeRange(user, AAL2, account.id, {
      from: "2024-01-01",
      to: "2024-02-28",
    });
    expect(summary.txnCount).toBeGreaterThanOrEqual(2);
    expect(summary.closing).toBeGreaterThan(0);
  });

  test("delete import removes batch rows", async () => {
    const importRow = await service.createImport(user, AAL2, account.id);
    await service.createMany(user, AAL2, account.id, importRow.id, [
      {
        date: "2024-03-01",
        amount: 500,
        sourceAccountId: unknownId,
        destinationAccountId: account.id,
        description: "Coffee shop",
      },
    ]);
    await service.deleteImport(user, AAL2, account.id, importRow.id);
    const list = await service.listInRange(user, AAL2, account.id, {
      from: "2024-03-01",
      to: "2024-03-31",
    });
    expect(list.total).toBe(0);
  });

  test("listInRange orders newest transaction date first", async () => {
    await service.create(user, AAL2, account.id, {
      date: "2025-06-01",
      amount: 100,
      sourceAccountId: unknownId,
      destinationAccountId: account.id,
      description: "Coffee shop",
    });
    await service.create(user, AAL2, account.id, {
      date: "2025-06-15",
      amount: 200,
      sourceAccountId: unknownId,
      destinationAccountId: account.id,
      description: "Coffee shop",
    });
    const list = await service.listInRange(
      user,
      AAL2,
      account.id,
      { from: "2025-06-01", to: "2025-06-30" },
      { limit: 10, offset: 0 }
    );
    expect(list.total).toBeGreaterThanOrEqual(2);
    const juneItems = list.items.filter((txn) => txn.date.startsWith("2025-06"));
    expect(juneItems[0]?.date).toBe("2025-06-15");
  });

  test("word filter matches description substring case-insensitively", async () => {
    await service.create(user, AAL2, account.id, {
      date: "2024-04-01",
      amount: 100,
      sourceAccountId: unknownId,
      destinationAccountId: account.id,
      description: "Coffee shop",
    });
    const miss = await service.listInRange(user, AAL2, account.id, {
      from: "2024-04-01",
      to: "2024-04-30",
      word: "fee",
    });
    expect(miss.total).toBe(0);
    const hit = await service.listInRange(user, AAL2, account.id, {
      from: "2024-04-01",
      to: "2024-04-30",
      word: "shop",
    });
    expect(hit.total).toBe(1);
  });

  test("amountMin and amountMax filter transactions", async () => {
    await service.create(user, AAL2, account.id, {
      date: "2024-09-01",
      amount: 100,
      sourceAccountId: unknownId,
      destinationAccountId: account.id,
      description: "Small",
    });
    await service.create(user, AAL2, account.id, {
      date: "2024-09-02",
      amount: 500,
      sourceAccountId: unknownId,
      destinationAccountId: account.id,
      description: "Large",
    });
    const band = await service.listInRange(user, AAL2, account.id, {
      from: "2024-09-01",
      to: "2024-09-30",
      amountMin: 200,
      amountMax: 600,
    });
    expect(band.total).toBe(1);
    expect(band.items[0]?.amount).toBe(500);
  });

  test("summarizeRange sumAmounts respects list filters", async () => {
    await service.create(user, AAL2, account.id, {
      date: "2024-06-01",
      amount: 100,
      sourceAccountId: unknownId,
      destinationAccountId: account.id,
      description: "Alpha purchase",
    });
    await service.create(user, AAL2, account.id, {
      date: "2024-06-02",
      amount: 900,
      sourceAccountId: unknownId,
      destinationAccountId: account.id,
      description: "Beta purchase",
    });
    const filtered = await service.summarizeRange(user, AAL2, account.id, {
      from: "2024-06-01",
      to: "2024-06-30",
      word: "alpha",
    });
    expect(filtered.txnCount).toBe(1);
    expect(filtered.amountCredit).toBe(100);
  });
});
