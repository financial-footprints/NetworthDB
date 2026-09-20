import { beforeAll, describe, expect, test } from "bun:test";
import { JobScope } from "@core/domains/jobs/embedded/scope";
import { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import { JobService } from "@core/domains/jobs/services/job-service";
import { User, Username } from "@core/domains/user/entities/user/index";
import { EntityNotFoundError } from "@core/shared/errors/domain-error";
import { InMemoryJobRepository } from "@core/tests/fakes/in-memory-job-repository";
import { InMemoryUserRepository } from "@core/tests/fakes/in-memory-user-repository";

const UNKNOWN_JOB_ID = "00000000-0000-4000-8000-000000000099";

describe("JobService", () => {
  let actor: User;
  let service: JobService;
  let runner: JobRunnerService;

  beforeAll(async () => {
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
    const jobs = new InMemoryJobRepository();
    runner = new JobRunnerService(jobs, 1);
    service = new JobService(jobs, runner);
  });

  test("cancel with unknown id throws EntityNotFoundError", async () => {
    await expect(service.cancel(actor, "aal1", UNKNOWN_JOB_ID)).rejects.toBeInstanceOf(
      EntityNotFoundError
    );
  });

  test("cancel without id cancels all active jobs", async () => {
    const first = await runner.submit(
      actor.id,
      "upload",
      JobScope.create({ accountId: "acct-1" }),
      async () => {
        await Bun.sleep(100);
        return {};
      }
    );
    const second = await runner.submit(
      actor.id,
      "upload",
      JobScope.create({ accountId: "acct-2" }),
      async () => {
        await Bun.sleep(100);
        return {};
      }
    );

    const result = await service.cancel(actor, "aal1");
    expect(result.cancelledIds.sort()).toEqual([first.id, second.id].sort());
  });

  test("cancel with id cancels only that job", async () => {
    const first = await runner.submit(
      actor.id,
      "upload",
      JobScope.create({ accountId: "acct-3" }),
      async () => {
        await Bun.sleep(100);
        return {};
      }
    );
    const second = await runner.submit(
      actor.id,
      "upload",
      JobScope.create({ accountId: "acct-4" }),
      async () => {
        await Bun.sleep(100);
        return {};
      }
    );

    const result = await service.cancel(actor, "aal1", first.id);
    expect(result.cancelledIds).toEqual([first.id]);

    const updatedSecond = await runner.requestCancel(actor.id, second.id);
    expect(updatedSecond?.status).toBe("cancelled");
  });
});
