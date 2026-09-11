import type { StatementEngine, StatementsRuntime } from "@ndb/core";
import { createStatementEngine, initStatementsRuntime } from "@ndb/statements";

let engine: StatementEngine = createStatementEngine();

export function initTestStatementsRuntime(config?: {
  filestorePath?: string;
  encryptAtRest?: boolean;
}): void {
  initStatementsRuntime(config);
  engine = createStatementEngine();
}

export function testStatementEngine(): StatementEngine {
  return engine;
}

export function testStatementsRuntime(pipelineTrace = false): StatementsRuntime {
  return {
    engine: testStatementEngine(),
    pipelineTrace,
  };
}
