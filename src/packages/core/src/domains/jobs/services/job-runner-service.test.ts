import { describe, expect, test } from "bun:test";
import { JobExecutionError } from "@core/domains/jobs/embedded/output";
import { JobScope } from "@core/domains/jobs/embedded/scope";
import { Job } from "@core/domains/jobs/entities/job";
import { JobRunnerService } from "@core/domains/jobs/services/job-runner-service";
import { ConflictError } from "@core/shared/errors/domain-error";
import { InMemoryJobRepository } from "@core/tests/fakes/in-memory-job-repository";

describe("JobRunnerService", () => {
  test("submit rejects duplicate active jobs", async () => {
    const runner = new JobRunnerService(new InMemoryJobRepository(), 1);
    const scope = JobScope.create({ accountId: "acct-1" });

    await runner.submit("user-1", "upload", scope, async () => {
      await Bun.sleep(50);
      return {};
    });

    await expect(runner.submit("user-1", "upload", scope, async () => ({}))).rejects.toBeInstanceOf(
      ConflictError
    );
  });

  test("completes upload job", async () => {
    const repo = new InMemoryJobRepository();
    const runner = new JobRunnerService(repo, 1);
    let moved = false;

    const job = await runner.submit(
      "user-1",
      "upload",
      JobScope.create({ accountId: "acct-1" }),
      async () => {
        moved = true;
        return {};
      }
    );

    await Bun.sleep(20);
    const updated = await repo.findById("user-1", job.id);
    expect(moved).toBe(true);
    expect(updated?.status).toBe("completed");
  });

  test("notifies cancel listeners", async () => {
    const repo = new InMemoryJobRepository();
    const runner = new JobRunnerService(repo, 1);
    const cancelledIds: string[] = [];
    runner.onCancel((jobId) => {
      cancelledIds.push(jobId);
    });

    const job = await runner.submit(
      "user-1",
      "sync",
      JobScope.create({ accountId: "acct-1" }),
      async () => {
        await Bun.sleep(50);
        return {};
      }
    );

    await runner.requestCancel("user-1", job.id);
    expect(cancelledIds).toContain(job.id);
  });

  test("persists job output from worker result", async () => {
    const repo = new InMemoryJobRepository();
    const runner = new JobRunnerService(repo, 1);
    const output = { warnings: [] };

    const job = await runner.submit(
      "user-1",
      "sync",
      JobScope.create({ accountId: "acct-1" }),
      async () => ({ output })
    );

    await Bun.sleep(20);
    const updated = await repo.findById("user-1", job.id);
    expect(updated?.status).toBe("completed");
    expect(updated?.output).toEqual(output);
  });

  test("persists logs incrementally via appendLog", async () => {
    const repo = new InMemoryJobRepository();
    const runner = new JobRunnerService(repo, 1);

    const job = await runner.submit(
      "user-1",
      "sync",
      JobScope.create({ accountId: "acct-1" }),
      async (_jobId, _shouldCancel, appendLog) => {
        await appendLog(
          '{"time":"2026-01-01T00:00:00.000Z","level":"info","msg":"extract.started","stage":"extract"}'
        );
        await appendLog(
          '{"time":"2026-01-01T00:00:01.000Z","level":"info","msg":"extract.completed","stage":"extract"}'
        );
        return {};
      }
    );

    await Bun.sleep(400);
    const updated = await repo.findById("user-1", job.id);
    expect(updated?.status).toBe("completed");
    expect(updated?.logs).toContain("extract.started");
    expect(updated?.logs).toContain("extract.completed");
  });

  test("persists logs on failure after appendLog", async () => {
    const repo = new InMemoryJobRepository();
    const runner = new JobRunnerService(repo, 1);
    const logs =
      '{"time":"2026-01-01T00:00:00.000Z","level":"info","msg":"extract.started","stage":"extract"}';

    const job = await runner.submit(
      "user-1",
      "sync",
      JobScope.create({ accountId: "acct-1" }),
      async (_jobId, _shouldCancel, appendLog) => {
        await appendLog(logs);
        throw new JobExecutionError("pipeline failed", { warnings: [] });
      }
    );

    await Bun.sleep(400);
    const updated = await repo.findById("user-1", job.id);
    expect(updated?.status).toBe("failed");
    expect(updated?.error).toBe("pipeline failed");
    expect(updated?.logs).toEqual(logs);
  });

  test("purgeExpiredLogs nulls logs older than retention window", async () => {
    const repo = new InMemoryJobRepository();
    const runner = new JobRunnerService(repo, 1);
    const scope = JobScope.create({ accountId: "acct-1" });
    const oldCompletedAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

    const job = await repo.create(
      Job.create({
        userId: "user-1",
        stage: "sync",
        scope,
      })
    );
    await repo.save(
      new Job(
        job.id,
        job.userId,
        job.stage,
        "completed",
        job.scope,
        job.createdAt,
        oldCompletedAt,
        job.output,
        null,
        '{"time":"2026-01-01T00:00:00.000Z","level":"info","msg":"started","stage":"extract"}'
      )
    );

    const purged = await runner.purgeExpiredLogs();
    const updated = await repo.findById("user-1", job.id);

    expect(purged).toBe(1);
    expect(updated?.logs).toBeNull();
  });
});

describe("Job.appendLogs", () => {
  test("concatenates chunks with newlines", () => {
    const job = Job.create({
      userId: "user-1",
      stage: "sync",
      scope: JobScope.create({ accountId: "acct-1" }),
    });

    const first = job.appendLogs("line-1");
    const second = first.appendLogs("line-2");

    expect(second.logs).toBe("line-1\nline-2");
  });
});
