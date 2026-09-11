import { dataEnvelopeSchema } from "@platform/http";
import { z } from "zod";

export const statementSyncReqSchema = z
  .object({
    scope: z
      .object({
        account_id: z.string().uuid().optional(),
        financial_year: z.string().optional(),
      })
      .optional(),
  })
  .transform((body) => ({
    accountId: body.scope?.account_id,
    financialYear: body.scope?.financial_year,
  }));

export const statementSyncCreatedSchema = dataEnvelopeSchema(
  z.object({
    id: z.string().uuid(),
  })
);
