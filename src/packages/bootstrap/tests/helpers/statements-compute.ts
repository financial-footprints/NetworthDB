import type { StatementEngine, StatementsServices } from "@ndb/core";
import { createPool, type Pool, wrap } from "@ndb/statements";

let pool: Pool | undefined;
let engine: StatementEngine;

export function initTestStatementsEngine(config?: {
  filestorePath?: string;
  encryptAtRest?: boolean;
}): StatementEngine {
  if (pool) {
    void pool.shutdown();
  }
  const runtime = {
    filestorePath: config?.filestorePath ?? `/tmp/networthdb-test-${process.pid}`,
    encryptAtRest: config?.encryptAtRest ?? false,
    logLevel: "debug" as const,
    environment: "local" as const,
  };
  pool = createPool({ threads: 1, runtime });
  engine = wrap(pool, runtime);
  return engine;
}

export async function shutdownTestStatementsEngine(): Promise<void> {
  await pool?.shutdown();
  pool = undefined;
}

export function testStatementEngine(): StatementEngine {
  if (!engine) {
    return initTestStatementsEngine();
  }
  return engine;
}

export function testStatementsServices(pipelineTrace = false): StatementsServices {
  return {
    engine: testStatementEngine(),
    trace: pipelineTrace,
  };
}
