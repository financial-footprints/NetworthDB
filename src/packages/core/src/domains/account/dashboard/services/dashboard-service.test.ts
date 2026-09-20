import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { DashboardService } from "@core/domains/account/dashboard/services/dashboard-service";
import { Account } from "@core/domains/account/entities/account";
import { AccountService } from "@core/domains/account/services/account-service";
import { Category } from "@core/domains/account/taxonomy/entities/category";
import { TransactionService } from "@core/domains/account/transactions/services/transaction-service";
import { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import { SourcesService } from "@core/domains/sources/services/sources-service";
import { User, Username } from "@core/domains/user/entities/user/index";
import { ValidationError } from "@core/shared/errors/domain-error";
import { InMemoryAccountRepository } from "@core/tests/fakes/in-memory-account-repository";
import { InMemoryCategoryRepository } from "@core/tests/fakes/in-memory-category-repository";
import { InMemoryDashboardRepository } from "@core/tests/fakes/in-memory-dashboard-repository";
import { InMemoryJobRepository } from "@core/tests/fakes/in-memory-job-repository";
import { InMemorySourcesRepository } from "@core/tests/fakes/in-memory-sources-repository";
import { InMemoryTagRepository } from "@core/tests/fakes/in-memory-tag-repository";
import { nullUserDataKeyLoader } from "@core/tests/fakes/null-user-data-key-loader";
import {
  shutdownTestStatementsEngine,
  testStatementsServices,
} from "@tests/bootstrap/helpers/statements-compute";

const AAL2 = "aal2";

describe("DashboardService", () => {
  let user: User;
  let bankA: Account;
  let bankB: Account;
  let unknownId: string;
  let expenseId: string;
  let revenueId: string;
  let foodId: string;
  let groceriesId: string;
  let incomeCatId: string;
  let transactionService: TransactionService;
  let dashboardService: DashboardService;

  beforeAll(async () => {
    user = new User(
      crypto.randomUUID(),
      Username.parse("dashboard_user"),
      "hash",
      "user",
      true,
      new Date()
    );
    bankA = Account.create({
      userId: user.id,
      accountType: "bank",
      bank: "HDFC",
      openingDate: "2020-01-01",
      accountNumber: "1111111111",
      passwords: [],
    });
    bankB = Account.create({
      userId: user.id,
      accountType: "bank",
      bank: "ICICI",
      openingDate: "2020-01-01",
      accountNumber: "2222222222",
      passwords: [],
    });

    const accounts = new InMemoryAccountRepository();
    const transactions = accounts.transactions;
    const categories = new InMemoryCategoryRepository();
    const tags = new InMemoryTagRepository();

    await accounts.create(bankA);
    await accounts.create(bankB);

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
    revenueId = system.find((item) => item.accountType === "revenue")?.id ?? "";

    const food = Category.create({ userId: user.id, parentId: null, name: "Food" });
    const groceries = Category.create({
      userId: user.id,
      parentId: food.id,
      name: "Groceries",
    });
    const incomeCat = Category.create({ userId: user.id, parentId: null, name: "Income" });
    await categories.create(food);
    await categories.create(groceries);
    await categories.create(incomeCat);
    foodId = food.id;
    groceriesId = groceries.id;
    incomeCatId = incomeCat.id;

    transactionService = new TransactionService(
      transactions,
      accounts,
      categories,
      tags,
      accountService
    );
    dashboardService = new DashboardService(
      new InMemoryDashboardRepository(transactions, accounts, categories),
      accounts,
      transactions
    );

    await transactionService.create(user, AAL2, bankA.id, {
      date: "2024-06-10",
      amount: 10000,
      sourceAccountId: bankA.id,
      destinationAccountId: expenseId,
      description: "Groceries",
      categoryId: foodId,
      subcategoryId: groceriesId,
    });
    await transactionService.create(user, AAL2, bankA.id, {
      date: "2024-06-11",
      amount: 2000,
      sourceAccountId: bankA.id,
      destinationAccountId: unknownId,
      description: "Unknown spend",
    });
    await transactionService.create(user, AAL2, bankA.id, {
      date: "2024-06-12",
      amount: 50000,
      sourceAccountId: revenueId,
      destinationAccountId: bankA.id,
      description: "Salary",
      categoryId: incomeCatId,
    });
    await transactionService.create(user, AAL2, bankA.id, {
      date: "2024-06-13",
      amount: 1000,
      sourceAccountId: bankA.id,
      destinationAccountId: bankB.id,
      description: "Transfer",
    });
  });

  afterAll(async () => {
    await shutdownTestStatementsEngine();
  });

  test("getSnapshot aggregates cashflow and categories", async () => {
    const snapshot = await dashboardService.getSnapshot(user, AAL2, "2024-06-01", "2024-06-30");

    expect(snapshot.cashflow.spend).toBe(12000);
    expect(snapshot.cashflow.income).toBe(50000);
    expect(snapshot.cashflow.net).toBe(38000);
    expect(snapshot.cashflow.transfer).toBe(1000);
    expect(snapshot.cashflow.uncategorizedSpend).toBe(2000);
    expect(snapshot.cashflow.unknownCounterpart).toBe(2000);
    expect(snapshot.period.bucket).toBe("day");

    const food = snapshot.spendByCategory.find((row) => row.name === "Food");
    const uncategorized = snapshot.spendByCategory.find((row) => row.name === "Uncategorized");
    expect(food?.amount).toBe(10000);
    expect(uncategorized?.amount).toBe(2000);

    const groceries = snapshot.spendBySubcategory.find((row) => row.name === "Groceries");
    expect(groceries?.amount).toBe(10000);

    expect(snapshot.spendByCategory.every((row) => row.name !== "Transfer")).toBe(true);
  });

  test("rejects inverted date range", async () => {
    await expect(
      dashboardService.getSnapshot(user, AAL2, "2024-06-30", "2024-06-01")
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      dashboardService.getSnapshot(user, AAL2, "2024-06-30", "2024-06-01")
    ).rejects.toMatchObject({ message: "Date range is invalid." });
  });

  test("getSnapshot without bounds includes transactions outside a narrow month", async () => {
    const bounded = await dashboardService.getSnapshot(user, AAL2, "2024-06-01", "2024-06-30");
    const unbounded = await dashboardService.getSnapshot(user, AAL2);

    expect(unbounded.cashflow.spend).toBe(bounded.cashflow.spend);
    expect(unbounded.cashflow.income).toBe(bounded.cashflow.income);
    expect(unbounded.period.from).toBe("2024-06-10");
  });
});
