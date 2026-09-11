import { beforeAll, describe, expect, test } from "bun:test";
import { Account } from "@core/domains/account/entities/account";
import { StatementService } from "@core/domains/account/modules/statements/services/statement-service";
import { AccountService } from "@core/domains/account/services/account-service";
import { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import { SourcesService } from "@core/domains/sources/services/sources-service";
import { User, Username } from "@core/domains/user/entities/user/index";
import {
  initTestStatementsRuntime,
  testStatementsRuntime,
} from "@tests/bootstrap/helpers/statements-compute";
import { InMemoryAccountRepository } from "@tests/core/fakes/in-memory-account-repository";
import { InMemoryJobRepository } from "@tests/core/fakes/in-memory-job-repository";
import { InMemorySourcesRepository } from "@tests/core/fakes/in-memory-sources-repository";
import { InMemoryUserRepository } from "@tests/core/fakes/in-memory-user-repository";
import { nullUserDataKeyLoader } from "@tests/core/fakes/null-user-data-key-loader";

const ACCOUNT_NUMBER_SAMPLE = "abc.def";

describe("StatementService", () => {
  let actor: User;
  let account: Account;
  let service: StatementService;

  beforeAll(async () => {
    initTestStatementsRuntime({
      filestorePath: `/tmp/networthdb-statement-test-${process.pid}`,
      encryptAtRest: false,
    });

    const users = new InMemoryUserRepository();
    const passwordHash = "stub-password-hash";
    actor = await users.create(
      new User(
        crypto.randomUUID(),
        Username.parse("alice"),
        passwordHash,
        "user",
        false,
        new Date()
      )
    );

    const accountRepository = new InMemoryAccountRepository();
    const jobRunner = new JobRunnerService(new InMemoryJobRepository(), 1);
    const statements = testStatementsRuntime();
    service = new StatementService(statements, accountRepository, jobRunner, nullUserDataKeyLoader);

    const accounts = new AccountService(
      accountRepository,
      new SourcesService(new InMemorySourcesRepository()),
      jobRunner,
      nullUserDataKeyLoader,
      statements
    );
    const created = await accounts.create(actor, "aal1", {
      bank: "onecard",
      accountType: "credit_card",
      openingDate: "2020-01-15",
      closingDate: "2024-12-31",
      accountNumber: ACCOUNT_NUMBER_SAMPLE,
      passwords: [],
    });
    account = created;
  });

  test("deleteArtifacts succeeds when no on-disk artifacts exist", async () => {
    const account = Account.create({
      userId: actor.id,
      bank: "onecard",
      accountType: "credit_card",
      openingDate: "2020-01-15",
      accountNumber: "abc.def",
      passwords: [],
    });

    await expect(service.deleteArtifacts(actor.id, account)).resolves.toBeUndefined();
  });

  test("listBanks includes OneCard", () => {
    const banks = service.listBanks();
    expect(banks.some((bank) => bank.bank === "onecard")).toBe(true);
  });

  test("getMetadata returns calendar and empty metadata", async () => {
    const metadata = await service.getMetadata(actor.id, account);
    expect(metadata.calendarStart).toBe("2020-01-15");
    expect(metadata.calendarEnd).toBe("2024-12-31");
    expect(metadata.calendarEndSource).toBe("configured");
    expect(metadata.closingDateConfigured).toBe(true);
    expect(metadata.statements.available).toBe(false);
    expect(metadata.calendarYearSections.length).toBeGreaterThan(0);
  });
});
