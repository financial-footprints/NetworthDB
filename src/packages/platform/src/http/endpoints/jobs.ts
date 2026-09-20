import { JOB_STAGES, JOB_STATUSES } from "@core/domains/jobs/constants";
import { detailsResponseSchema, paginatedListResponseSchema } from "@platform/http/envelopes";
import { z } from "zod";

const pipelineWarningSchema = z.object({
  kind: z.string(),
  message: z.string(),
  account: z.string(),
  sourceFile: z.string(),
  textContains: z.array(z.string()),
});

const jobOutputSchema = z.object({
  warnings: z.array(pipelineWarningSchema),
  backup: z
    .object({
      filename: z.string().optional(),
      bytes: z.number().int().nonnegative().optional(),
      accountsCreated: z.number().int().nonnegative().optional(),
      accountsUpdated: z.number().int().nonnegative().optional(),
      transactionsInserted: z.number().int().nonnegative().optional(),
      transactionsSkipped: z.number().int().nonnegative().optional(),
      vaultSlotsImported: z.number().int().nonnegative().optional(),
      vaultSlotsSkipped: z.number().int().nonnegative().optional(),
    })
    .optional(),
  rules: z
    .object({
      matched: z.number().int().nonnegative(),
      mutated: z.number().int().nonnegative(),
      deleted: z.number().int().nonnegative(),
      skipped: z.number().int().nonnegative(),
      dryRun: z.boolean(),
    })
    .optional(),
});

export const jobDataSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(JOB_STATUSES),
  stage: z.enum(JOB_STAGES),
  accountId: z.string().nullable(),
  financialYear: z.string().nullable(),
  ruleId: z.string().uuid().nullable(),
  groupId: z.string().uuid().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  output: jobOutputSchema,
  error: z.string().nullable(),
  logs: z.string().nullable().optional(),
});

export const jobIdParamsSchema = z.object({
  jobId: z.string().uuid(),
});

export const jobSchema = detailsResponseSchema(jobDataSchema);
export const jobListSchema = paginatedListResponseSchema(jobDataSchema);

export const jobsCancelQuerySchema = z.object({
  jobId: z.string().uuid().optional(),
});

export const jobsCancelSchema = detailsResponseSchema(
  z.object({
    cancelledIds: z.array(z.string().uuid()),
  })
);

export const jobCreatedSchema = detailsResponseSchema(
  z.object({
    jobId: z.string().uuid(),
  })
);
