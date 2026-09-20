import { detailsResponseSchema } from "@platform/http/envelopes";
import { z } from "zod";

export const backupExportBodySchema = z.object({
  password: z.string().min(8),
});

export const backupExportStatusSchema = detailsResponseSchema(
  z.object({
    current: z
      .object({
        filename: z.string(),
        bytes: z.number().int().nonnegative(),
        createdAt: z.string(),
        expiresAt: z.string(),
      })
      .nullable(),
    activeJobId: z.string().uuid().nullable(),
    activeImportJobId: z.string().uuid().nullable(),
  })
);
