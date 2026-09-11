import type { StatementWarning } from "@core/domains/account/modules/statements/types";

export type JobOutput = {
  warnings: StatementWarning[];
};

export const EMPTY_JOB_OUTPUT: JobOutput = { warnings: [] };

export function jobWarningOutputs(warnings: StatementWarning[]): JobOutput {
  return { warnings };
}

export type JobLogs = string;

export class JobExecutionError extends Error {
  constructor(
    message: string,
    readonly output?: JobOutput,
    readonly logs?: JobLogs
  ) {
    super(message);
    this.name = "JobExecutionError";
  }
}
