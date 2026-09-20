import { z } from "zod";

export const statementSyncReqSchema = z.object({
  accountId: z.string().uuid(),
  financialYear: z.string().optional(),
});
