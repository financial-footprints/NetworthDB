import type { PipelineRun } from "@core/domains/account/statements/entities/pipeline";
import type { StatementPipelineResult } from "@core/domains/account/statements/types";
import { JobExecutionError, jobWarningOutputs } from "@core/domains/jobs/embedded/output";
import type { AppendLogFn, JobFnResult } from "@core/domains/jobs/services/job-runner-service";

export async function executeStatementJob(
  pipeline: PipelineRun,
  shouldCancel: () => boolean,
  appendLog: AppendLogFn,
  run: (
    shouldCancel: () => boolean,
    onLogLine?: (line: string) => void
  ) => Promise<StatementPipelineResult>,
  failureMessage: string
): Promise<JobFnResult> {
  if (shouldCancel()) {
    return {};
  }

  const onLogLine = pipeline.trace
    ? (line: string) => {
        void appendLog(line);
      }
    : undefined;

  const result = await run(shouldCancel, onLogLine);
  const jobOutput = jobWarningOutputs(result.warnings ?? []);

  if (!result.ok) {
    if (result.reason === "cancelled by user" || shouldCancel()) {
      return { output: jobOutput };
    }
    throw new JobExecutionError(result.reason ?? failureMessage, jobOutput);
  }

  return { output: jobOutput };
}
