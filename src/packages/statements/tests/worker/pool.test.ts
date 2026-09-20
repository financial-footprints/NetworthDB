import { afterEach, describe, expect, test } from "bun:test";
import { Account } from "@core/domains/account/entities/account";
import { PipelineRun } from "@core/domains/account/statements/entities/pipeline";
import { createPool } from "@statements/index";
import { serializePipelineRun } from "@statements/pipeline/jobs/serde";

const runtime = {
  filestorePath: `/tmp/networthdb-worker-pool-test-${process.pid}`,
  encryptAtRest: false,
  logLevel: "info" as const,
  environment: "local" as const,
};

function deletePayload(jobId: string) {
  const account = Account.create({
    userId: "user-1",
    accountType: "credit_card",
    bank: "onecard",
    openingDate: "2020-01-01",
    accountNumber: "acc-1",
    passwords: [],
  });
  const pipeline = PipelineRun.createDelete({
    jobId,
    userId: "user-1",
    account,
    dataKey: null,
    trace: false,
  });
  return {
    method: "deleteAccountStatements" as const,
    pipeline: serializePipelineRun(pipeline),
  };
}

describe("Pool", () => {
  let pool: ReturnType<typeof createPool> | undefined;

  afterEach(async () => {
    await pool?.shutdown();
    pool = undefined;
  });

  test("keeps the main thread responsive while a worker runs", async () => {
    pool = createPool({ threads: 1, runtime });

    let immediateRan = false;
    const runPromise = pool.run(deletePayload("job-1"), "job-1");

    await new Promise<void>((resolve) => {
      setImmediate(() => {
        immediateRan = true;
        resolve();
      });
    });

    expect(immediateRan).toBe(true);
    await expect(runPromise).resolves.toEqual({
      ok: true,
      warnings: [],
    });
  });

  test("forwards progress lines to onProgress", async () => {
    pool = createPool({ threads: 1, runtime });

    const lines: string[] = [];
    const payload = deletePayload("job-progress");
    payload.pipeline.trace = true;

    await pool.run(payload, "job-progress", (line) => {
      lines.push(line);
    });

    expect(lines.some((line) => line.includes('"msg":"delete.started"'))).toBe(true);
    expect(lines.some((line) => line.includes('"msg":"delete.completed"'))).toBe(true);
  });

  test("cancels queued jobs by job id", async () => {
    pool = createPool({ threads: 1, runtime });

    const first = pool.run(deletePayload("job-1"), "job-1");
    const second = pool.run(deletePayload("job-2"), "job-2");

    pool.cancel("job-2");

    await expect(first).resolves.toEqual({
      ok: true,
      warnings: [],
    });
    await expect(second).resolves.toEqual({
      ok: false,
      reason: "cancelled by user",
      warnings: [],
    });
  });
});
