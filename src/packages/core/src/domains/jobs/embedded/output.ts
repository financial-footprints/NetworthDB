import type { StatementWarning } from "@core/domains/account/statements/types";

export type BackupJobOutput = {
  filename?: string;
  bytes?: number;
  accountsCreated?: number;
  accountsUpdated?: number;
  transactionsInserted?: number;
  transactionsSkipped?: number;
  vaultSlotsImported?: number;
  vaultSlotsSkipped?: number;
};

export type RulesJobOutput = {
  matched: number;
  mutated: number;
  deleted: number;
  skipped: number;
  dryRun: boolean;
};

export type JobOutput = {
  warnings: StatementWarning[];
  backup?: BackupJobOutput;
  rules?: RulesJobOutput;
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
