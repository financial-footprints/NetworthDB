import type { StatementPipelineResult, StatementWarning } from "@ndb/core";

export function toStatementPipelineResult(input: {
  ok: boolean;
  warnings?: StatementWarning[];
  reason?: string;
  logs?: string;
}): StatementPipelineResult {
  return {
    ok: input.ok,
    reason: input.reason,
    warnings: input.warnings ?? [],
    logs: input.logs,
  };
}

export function cancelledResult(): StatementPipelineResult {
  return toStatementPipelineResult({
    ok: false,
    reason: "cancelled by user",
  });
}
