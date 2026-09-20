import { z } from "zod";

export const applyRulesReqSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  accountId: z.string().uuid().optional(),
  word: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  subcategoryId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  dryRun: z.boolean().optional().default(false),
});
