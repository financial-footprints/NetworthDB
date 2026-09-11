import { beforeAll, describe, expect, test } from "bun:test";
import { Account } from "@core/domains/account/entities/account";
import { AccountService } from "@core/domains/account/services/account-service";
import { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import { SourcesService } from "@core/domains/sources/services/sources-service";
import { User, Username } from "@core/domains/user/entities/user/index";
import { UnauthorizedError, ValidationError } from "@core/shared/errors/domain-error";
import { testStatementsRuntime } from "@tests/bootstrap/helpers/statements-compute";
import { InMemoryAccountRepository } from "@tests/core/fakes/in-memory-account-repository";
import { InMemoryJobRepository } from "@tests/core/fakes/in-memory-job-repository";
import { InMemorySourcesRepository } from "@tests/core/fakes/in-memory-sources-repository";
import { InMemoryUserRepository } from "@tests/core/fakes/in-memory-user-repository";
import { nullUserDataKeyLoader } from "@tests/core/fakes/null-user-data-key-loader";

const ACCOUNT_NUMBER_SAMPLE = "abc.def";

describe("AccountService", () => {
  let user: User;
  let otherUser: User;
  let service: AccountService;

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
    service = new AccountService(
      new InMemoryAccountRepository(),
      new SourcesService(new InMemorySourcesRepository()),
      jobRunner,
      nullUserDataKeyLoader,
      testStatementsRuntime()
    );
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
      accountType: "bank_account",
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
    expect(result.items.every((item) => item.accountType === "credit_card")).toBe(true);
  });

  test("get rejects cross-user access", async () => {
    const created = await service.create(user, "aal1", {
      bank: "PNB",
      accountType: "bank_account",
      openingDate: "2018-01-01",
      accountNumber: ACCOUNT_NUMBER_SAMPLE,
      passwords: [],
    });

    await expect(service.get(otherUser, "aal1", created.id)).rejects.toMatchObject({
      code: "not_found",
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
});
