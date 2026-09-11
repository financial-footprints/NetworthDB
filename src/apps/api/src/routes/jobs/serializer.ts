import type { Job, JobOutput } from "@ndb/core";
import { jobListSchema, jobSchema, jobsCancelSchema } from "@ndb/platform";

function serializeJobOutput(output: JobOutput) {
  return {
    warnings: output.warnings.map((warning) => ({
      kind: warning.kind,
      message: warning.message,
      account: warning.account,
      source_file: warning.sourceFile,
      text_contains: [...warning.textContains],
    })),
  };
}

function serializeJobData(job: Job, includeLogs = false) {
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    account_id: job.scope.accountId,
    financial_year: job.scope.financialYear,
    created_at: job.createdAt.toISOString(),
    completed_at: job.completedAt?.toISOString() ?? null,
    output: serializeJobOutput(job.output),
    error: job.error,
    ...(includeLogs ? { logs: job.logs } : {}),
  };
}

export function serializeJob(job: Job) {
  return jobSchema.parse({
    data: serializeJobData(job, true),
    errors: [],
  });
}

export function serializeJobList(items: Job[], total: number) {
  return jobListSchema.parse({
    data: {
      items: items.map((job) => serializeJobData(job)),
      total,
    },
    errors: [],
  });
}

export function serializeJobsCancel(cancelledIds: string[]) {
  return jobsCancelSchema.parse({
    data: { cancelled_ids: cancelledIds },
    errors: [],
  });
}
