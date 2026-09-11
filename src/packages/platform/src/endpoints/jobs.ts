import { JOB_STAGES, JOB_STATUSES } from "@ndb/core";
import { dataEnvelopeSchema, paginatedDataEnvelopeSchema } from "@platform/http";
import { z } from "zod";

const pipelineWarningSchema = z.object({
  kind: z.string(),
  message: z.string(),
  account: z.string(),
  source_file: z.string(),
  text_contains: z.array(z.string()),
});

const jobOutputSchema = z.object({
  warnings: z.array(pipelineWarningSchema),
});

const jobDataSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(JOB_STATUSES),
  stage: z.enum(JOB_STAGES),
  account_id: z.string().nullable(),
  financial_year: z.string().nullable(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
  output: jobOutputSchema,
  error: z.string().nullable(),
  logs: z.string().nullable().optional(),
});

export const jobIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const jobSchema = dataEnvelopeSchema(jobDataSchema);
export const jobListSchema = paginatedDataEnvelopeSchema(jobDataSchema);

export const jobsCancelQuerySchema = z.object({
  id: z.string().uuid().optional(),
});

export const jobsCancelSchema = dataEnvelopeSchema(
  z.object({
    cancelled_ids: z.array(z.string().uuid()),
  })
);

export const jobCreatedSchema = dataEnvelopeSchema(
  z.object({
    id: z.string().uuid(),
  })
);
