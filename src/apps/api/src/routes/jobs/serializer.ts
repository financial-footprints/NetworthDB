import type { Job, JobOutput } from "@ndb/core";
import { jobCreatedSchema, jobListSchema, jobSchema, jobsCancelSchema } from "@ndb/platform";

type JobBackupOutput = NonNullable<JobOutput["backup"]>;

function serializeBackupOutput(backup: JobBackupOutput) {
  return {
    ...(backup.filename !== undefined ? { filename: backup.filename } : {}),
    ...(backup.bytes !== undefined ? { bytes: backup.bytes } : {}),
    ...(backup.accountsCreated !== undefined ? { accountsCreated: backup.accountsCreated } : {}),
    ...(backup.accountsUpdated !== undefined ? { accountsUpdated: backup.accountsUpdated } : {}),
    ...(backup.transactionsInserted !== undefined
      ? { transactionsInserted: backup.transactionsInserted }
      : {}),
    ...(backup.transactionsSkipped !== undefined
      ? { transactionsSkipped: backup.transactionsSkipped }
      : {}),
    ...(backup.vaultSlotsImported !== undefined
      ? { vaultSlotsImported: backup.vaultSlotsImported }
      : {}),
    ...(backup.vaultSlotsSkipped !== undefined
      ? { vaultSlotsSkipped: backup.vaultSlotsSkipped }
      : {}),
  };
}

function serializeJobOutput(output: JobOutput) {
  return {
    warnings: output.warnings.map((warning) => ({
      kind: warning.kind,
      message: warning.message,
      account: warning.account,
      sourceFile: warning.sourceFile,
      textContains: [...warning.textContains],
    })),
    ...(output.backup ? { backup: serializeBackupOutput(output.backup) } : {}),
    ...(output.rules
      ? {
          rules: {
            matched: output.rules.matched,
            mutated: output.rules.mutated,
            deleted: output.rules.deleted,
            skipped: output.rules.skipped,
            dryRun: output.rules.dryRun,
          },
        }
      : {}),
  };
}

function serializeJobData(job: Job, includeLogs = false) {
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    accountId: job.scope.accountId,
    financialYear: job.scope.financialYear,
    ruleId: job.scope.ruleId,
    groupId: job.scope.groupId,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
    output: serializeJobOutput(job.output),
    error: job.error,
    ...(includeLogs ? { logs: job.logs } : {}),
  };
}

export function serializeJob(job: Job) {
  return jobSchema.parse({
    data: serializeJobData(job, true),
  });
}

export function serializeJobList(items: Job[], total: number) {
  return jobListSchema.parse({
    items: items.map((job) => serializeJobData(job)),
    total,
  });
}

export function serializeJobsCancel(cancelledIds: string[]) {
  return jobsCancelSchema.parse({
    data: { cancelledIds },
  });
}

export function serializeJobCreated(id: string) {
  return jobCreatedSchema.parse({
    data: { jobId: id },
  });
}
