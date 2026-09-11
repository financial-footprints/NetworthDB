import type { StatementPipelineResult } from "@ndb/core";
import type { ProcessResult as NativeStatementPipelineResult } from "../../native.d.ts";

export const statementPipelineResult = {
  toDomain: (result: NativeStatementPipelineResult): StatementPipelineResult => ({
    ok: result.ok,
    reason: result.reason ?? undefined,
    warnings: result.warnings.map((warning) => ({
      kind: warning.kind,
      message: warning.message,
      account: warning.account,
      sourceFile: warning.sourceFile,
      textContains: [...warning.textContains],
    })),
    logs: result.logs ?? undefined,
  }),
};
