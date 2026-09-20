import type { SchemaTableDoc } from "@database/operations/describe/index";
import { bytea } from "@database/schema/types";
import { users } from "@database/schema/users/index";
import { JOB_STAGES, JOB_STATUSES, type JobScopeJson } from "@ndb/core";
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const jobStageEnum = pgEnum("job_stage", JOB_STAGES);
export const jobStatusEnum = pgEnum("job_status", JOB_STATUSES);

export const jobsSchemaDoc: SchemaTableDoc = {
  summary: "Async job queue metadata (upload, sync, backup, rules_apply).",
  omittedColumns: [
    { name: "output", reason: "encrypted job output blob is not selectable" },
    { name: "error", reason: "encrypted job error blob is not selectable" },
    { name: "logs", reason: "encrypted job logs blob is not selectable" },
  ],
  columnEnums: { stage: JOB_STAGES, status: JOB_STATUSES },
  jsonShapes: {
    job_scope: "Stage-specific scope JSON (account id, file paths, rule ids, etc.)",
  },
};

export const jobs = pgTable(
  "jobs",
  {
    createdAt: timestamp("created_at").notNull(),
    completedAt: timestamp("completed_at"),
    stage: jobStageEnum("stage").notNull(),
    status: jobStatusEnum("status").notNull(),
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobScopeKey: text("job_scope_key").notNull(),
    jobScope: jsonb("job_scope").$type<JobScopeJson>().notNull(),
    output: bytea("output"),
    error: bytea("error"),
    logs: bytea("logs"),
  },
  (table) => [
    index("jobs_scope_status_idx").on(table.userId, table.stage, table.jobScopeKey, table.status),
  ]
);
