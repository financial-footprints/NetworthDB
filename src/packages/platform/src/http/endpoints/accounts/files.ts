import { z } from "zod";

export const accountFileDownloadQuerySchema = z
  .object({
    statement_date: z.string().min(1, { message: "Statement date is required." }),
    format: z.string().min(1, { message: "Format is required." }),
  })
  .transform((query) => ({
    statementDate: query.statement_date,
    format: query.format,
  }));
