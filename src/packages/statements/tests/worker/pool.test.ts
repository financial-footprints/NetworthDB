import { afterEach, describe, expect, test } from "bun:test";
import { initStatementsRuntime } from "@ndb/statements";
import { createPool } from "@statements/worker/pool.ts";

const runtime = {
  filestorePath: `/tmp/networthdb-worker-pool-test-${process.pid}`,
  encryptAtRest: false,
};

const emptyRun = {
  userId: "user-1",
  scope: {
    accountId: null,
    financialYear: null,
  },
  accounts: [],
  sources: [],
};

describe("Pool", () => {
  let pool: ReturnType<typeof createPool> | undefined;

  afterEach(async () => {
    await pool?.shutdown();
    pool = undefined;
  });

  test("keeps the main thread responsive while a worker runs", async () => {
    initStatementsRuntime(runtime);
    pool = createPool({ threads: 1, runtime });

    let immediateRan = false;
    const runPromise = pool.run({
      method: "processPipeline",
      run: emptyRun,
      dataKey: null,
    });

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

  test("cancels queued jobs by job id", async () => {
    initStatementsRuntime(runtime);
    pool = createPool({ threads: 1, runtime });

    const first = pool.run(
      {
        method: "processPipeline",
        run: emptyRun,
        dataKey: null,
      },
      "job-1"
    );
    const second = pool.run(
      {
        method: "processPipeline",
        run: emptyRun,
        dataKey: null,
      },
      "job-2"
    );

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
