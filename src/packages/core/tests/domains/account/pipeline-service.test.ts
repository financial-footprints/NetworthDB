import { beforeAll, describe, expect, test } from "bun:test";
import { PipelineService } from "@core/domains/account/modules/statements/services/pipeline-service";
import { AccountService } from "@core/domains/account/services/account-service";
import { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import { SourcesService } from "@core/domains/sources/services/sources-service";
import { User, Username } from "@core/domains/user/entities/user/index";
import { ValidationError } from "@core/shared/errors/domain-error";
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

describe("PipelineService", () => {
  let actor: User;
  let account: AccountService;
  let sources: SourcesService;
  let jobRepository: InMemoryJobRepository;
  let service: PipelineService;

  beforeAll(async () => {
    initTestStatementsRuntime({
      filestorePath: `/tmp/networthdb-pipeline-test-${process.pid}`,
      encryptAtRest: false,
    });

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
    const statements = testStatementsRuntime();
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
  });

  test("sync rejects when no sources configured", async () => {
    await expect(service.sync(actor, "aal1")).rejects.toBeInstanceOf(ValidationError);
  });

  test("sync enqueues failed job when thunderbird profile is missing", async () => {
    await account.create(actor, "aal1", {
      bank: "onecard",
      accountType: "credit_card",
      openingDate: "2020-01-15",
      accountNumber: ACCOUNT_NUMBER_SAMPLE,
      passwords: [],
    });

    await sources.updateSources(actor, "aal1", {
      sources: [
        {
          id: "tb-1",
          type: "thunderbird",
          profile: "/home/user/.thunderbird/abc",
        },
      ],
    });

    const result = await service.sync(actor, "aal1");
    await Bun.sleep(30);

    const job = await jobRepository.findById(actor.id, result.jobId);
    expect(job?.status).toBe("failed");
    expect(job?.error).toContain("profile directory not found");
  });
});
