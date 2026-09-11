import { accountIdParamsSchema } from "@platform/endpoints/accounts/index";
import { z } from "zod";

export const accountFileDownloadQuerySchema = z
  .object({
    statement_date: z
      .string()
      .min(1, { message: "api.accounts.files.invalid.statement-date-required" }),
    format: z.string().min(1, { message: "api.accounts.files.invalid.format-required" }),
  })
  .transform((query) => ({
    statementDate: query.statement_date,
    format: query.format,
  }));

export const accountFileDownloadParamsSchema = accountIdParamsSchema;
