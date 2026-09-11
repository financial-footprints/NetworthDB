import type { StatementsRuntime } from "@core/domains/account/modules/statements/embedded/pipeline-context";
import type { StatementPipelineResult } from "@core/domains/account/modules/statements/types";
import { JobExecutionError, jobWarningOutputs } from "@core/domains/jobs/embedded/output";
import type { JobFnResult } from "@core/domains/jobs/services/job-runner-service";
import type { StatementEngineJobOptions } from "@core/ports/statement-engine";

export async function executeStatementJob(
  runtime: StatementsRuntime,
  jobId: string,
  shouldCancel: () => boolean,
  run: (options: StatementEngineJobOptions) => Promise<StatementPipelineResult>,
  failureMessage: string
): Promise<JobFnResult> {
  if (shouldCancel()) {
    return {};
  }

  const result = await run({
    jobId,
    pipelineTrace: runtime.pipelineTrace,
  });
  const jobOutput = jobWarningOutputs(result.warnings ?? []);
  const logs = runtime.pipelineTrace && result.logs ? result.logs : undefined;

  if (!result.ok) {
    if (result.reason === "cancelled by user" || shouldCancel()) {
      return { output: jobOutput, logs };
    }
    throw new JobExecutionError(result.reason ?? failureMessage, jobOutput, logs);
  }

  return { output: jobOutput, logs };
}
