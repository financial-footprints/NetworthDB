import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AccountType } from "@core/domains/account/constants";
import { Account } from "@core/domains/account/entities/account";
import { AccountService } from "@core/domains/account/services/account-service";
import { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import { SourcesService } from "@core/domains/sources/services/sources-service";
import { User, Username } from "@core/domains/user/entities/user/index";
import { UnauthorizedError, ValidationError } from "@core/shared/errors/domain-error";
import { InMemoryAccountRepository } from "@core/tests/fakes/in-memory-account-repository";
import { InMemoryJobRepository } from "@core/tests/fakes/in-memory-job-repository";
import { InMemorySourcesRepository } from "@core/tests/fakes/in-memory-sources-repository";
import { InMemoryUserRepository } from "@core/tests/fakes/in-memory-user-repository";
import { nullUserDataKeyLoader } from "@core/tests/fakes/null-user-data-key-loader";
import {
  shutdownTestStatementsEngine,
  testStatementsServices,
} from "@tests/bootstrap/helpers/statements-compute";

const ACCOUNT_NUMBER_SAMPLE = "abc.def";

describe("AccountService", () => {
  let user: User;
  let otherUser: User;
  let service: AccountService;
  let accountsRepo: InMemoryAccountRepository;

  beforeAll(async () => {
    const users = new InMemoryUserRepository();
    const passwordHash = "stub-password-hash";
    user = await users.create(
      new User(
        crypto.randomUUID(),
        Username.parse("alice"),
        passwordHash,
        "user",
        false,
        new Date()
      )
    );
    otherUser = await users.create(
      new User(crypto.randomUUID(), Username.parse("bob"), passwordHash, "user", false, new Date())
    );
    const jobRunner = new JobRunnerService(new InMemoryJobRepository(), 1);
    accountsRepo = new InMemoryAccountRepository();
    service = new AccountService(
      accountsRepo,
      new SourcesService(new InMemorySourcesRepository()),
      jobRunner,
      nullUserDataKeyLoader,
      testStatementsServices()
    );
  });

  afterAll(async () => {
    await shutdownTestStatementsEngine();
  });

  test("create derives label from bank and variant", async () => {
    const created = await service.create(user, "aal1", {
      bank: "HDFC",
      variant: "Regalia",
      accountType: "credit_card",
      openingDate: "2020-01-15",
      accountNumber: ACCOUNT_NUMBER_SAMPLE,
      passwords: ["secret"],
    });

    expect(created.label).toBe(Account.generateLabel("HDFC", "Regalia"));
    expect(created.hasPasswords()).toBe(true);
    expect(created.accountType).toBe("credit_card");
  });

  test("create stores the catalog title for a credit card", async () => {
    const titled = new AccountService(
      accountsRepo,
      new SourcesService(new InMemorySourcesRepository()),
      new JobRunnerService(new InMemoryJobRepository(), 1),
      nullUserDataKeyLoader,
      testStatementsServices(),
      {
        title: async (bank, variant) =>
          bank.toLowerCase() === "bob" && variant === "easy" ? "Easy Shopping" : null,
      }
    );
    const created = await titled.create(user, "aal1", {
      bank: "bob",
      variant: "easy",
      accountType: "credit_card",
      openingDate: "2020-01-15",
      accountNumber: ACCOUNT_NUMBER_SAMPLE,
      passwords: [],
    });
    expect(created.label).toBe("Easy Shopping");
  });

  test("create rejects closing date before opening date", async () => {
    await expect(
      service.create(user, "aal1", {
        bank: "HDFC",
        accountType: "credit_card",
        openingDate: "2020-06-01",
        closingDate: "2020-01-01",
        accountNumber: ACCOUNT_NUMBER_SAMPLE,
        passwords: [],
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("patch merges secrets when passwords omitted", async () => {
    const created = await service.create(user, "aal1", {
      bank: "ICICI",
      accountType: "bank",
      openingDate: "2019-03-01",
      accountNumber: ACCOUNT_NUMBER_SAMPLE,
      passwords: ["keep-me"],
      mail: { subjects: ["statement"] },
    });

    const updated = await service.update(user, "aal1", created.id, {
      bank: "ICICI Bank",
    });

    expect(updated.bank).toBe("ICICI Bank");
    expect(updated.hasPasswords()).toBe(true);
    expect(updated.hasMailSettings()).toBe(true);
  });

  test("list filters by account type", async () => {
    const result = await service.list(user, "aal1", { accountType: "credit_card" });
    expect(result.items.every((item) => item.account.accountType === "credit_card")).toBe(true);
  });

  test("list filters by q on label or bank", async () => {
    await service.create(user, "aal1", {
      bank: "SearchableBank",
      accountType: "bank",
      openingDate: "2018-01-01",
      accountNumber: ACCOUNT_NUMBER_SAMPLE,
      passwords: [],
    });

    const result = await service.list(user, "aal1", { q: "Searchable" });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(
      result.items.every(
        (item) =>
          item.account.label.toLowerCase().includes("searchable") ||
          item.account.bank.toLowerCase().includes("searchable")
      )
    ).toBe(true);
  });

  test("list sorts by current balance", async () => {
    const low = await service.create(user, "aal1", {
      bank: "LowBalance",
      accountType: "bank",
      openingDate: "2018-01-01",
      accountNumber: ACCOUNT_NUMBER_SAMPLE,
      passwords: [],
    });
    const high = await service.create(user, "aal1", {
      bank: "HighBalance",
      accountType: "bank",
      openingDate: "2018-01-01",
      accountNumber: ACCOUNT_NUMBER_SAMPLE,
      passwords: [],
    });

    accountsRepo.setCurrentBalanceForTest(low.id, 100);
    accountsRepo.setCurrentBalanceForTest(high.id, 500_00);

    const result = await service.list(user, "aal1", {
      sort: { column: "currentBalance", direction: "desc" },
    });

    const ids = result.items.map((item) => item.account.id);
    expect(ids.indexOf(high.id)).toBeLessThan(ids.indexOf(low.id));
  });

  test("list returns zero balance when no summaries", async () => {
    const created = await service.create(user, "aal1", {
      bank: "ZeroBal",
      accountType: "bank",
      openingDate: "2018-01-01",
      accountNumber: ACCOUNT_NUMBER_SAMPLE,
      passwords: [],
    });

    const result = await service.list(user, "aal1", {});
    const row = result.items.find((item) => item.account.id === created.id);
    expect(row?.currentBalance).toBe(0);
  });

  test("get rejects cross-user access", async () => {
    const created = await service.create(user, "aal1", {
      bank: "PNB",
      accountType: "bank",
      openingDate: "2018-01-01",
      accountNumber: ACCOUNT_NUMBER_SAMPLE,
      passwords: [],
    });

    await expect(service.get(otherUser, "aal1", created.id)).rejects.toMatchObject({
      code: "ENTITY_NOT_FOUND",
    });
  });

  test("requires AAL2 when MFA enabled", async () => {
    const mfaUser = user.withMultifactorEnabled(true);

    await expect(
      service.create(mfaUser, "aal1", {
        bank: "Yes",
        accountType: "credit_card",
        openingDate: "2021-01-01",
        accountNumber: ACCOUNT_NUMBER_SAMPLE,
        passwords: [],
      })
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test("list defaults to open instruments and can show closed", async () => {
    const open = await service.create(user, "aal1", {
      bank: "OpenBank",
      accountType: "bank",
      openingDate: "2018-01-01",
      accountNumber: ACCOUNT_NUMBER_SAMPLE,
      passwords: [],
    });
    const closed = await service.create(user, "aal1", {
      bank: "ClosedBank",
      accountType: "loan",
      openingDate: "2018-01-01",
      closingDate: "2019-01-01",
      accountNumber: ACCOUNT_NUMBER_SAMPLE,
      passwords: [],
    });

    const openList = await service.list(user, "aal1", {});
    expect(openList.items.some((item) => item.account.id === open.id)).toBe(true);
    expect(openList.items.some((item) => item.account.id === closed.id)).toBe(false);

    const closedList = await service.list(user, "aal1", { listStatus: "closed" });
    expect(closedList.items.some((item) => item.account.id === closed.id)).toBe(true);

    const allList = await service.list(user, "aal1", { listStatus: "all" });
    expect(allList.items.some((item) => item.account.id === open.id)).toBe(true);
    expect(allList.items.some((item) => item.account.id === closed.id)).toBe(true);
  });

  test("ensureSystemAccounts creates four hidden accounts", async () => {
    const items = await service.listSystemAccounts(user, "aal1");
    expect(items).toHaveLength(4);
    expect(items.map((item) => item.accountType).sort()).toEqual(
      (["expense", "revenue", "tumbler", "unknown"] as AccountType[]).sort()
    );
    const listed = await service.list(user, "aal1", { listStatus: "all" });
    expect(listed.items.every((item) => item.account.accountType !== "unknown")).toBe(true);
  });

  test("create rejects system account types", async () => {
    await expect(
      service.create(user, "aal1", {
        bank: "Unknown",
        accountType: "unknown",
        openingDate: "2018-01-01",
        accountNumber: "-",
        passwords: [],
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
