export const JOB_STATUSES = ["queued", "running", "completed", "failed", "cancelled"] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const ACTIVE_JOB_STATUSES = ["queued", "running"] as const satisfies readonly JobStatus[];

export const JOB_STAGES = [
  "upload",
  "sync",
  "backup_export",
  "backup_import",
  "rules_apply",
] as const;

export type JobStage = (typeof JOB_STAGES)[number];

export function isActiveJobStatus(status: string): boolean {
  return (ACTIVE_JOB_STATUSES as readonly string[]).includes(status);
}
