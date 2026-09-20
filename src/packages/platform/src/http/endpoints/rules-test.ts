import { createTransactionReqSchema } from "@platform/http/endpoints/accounts/transactions";
import { catalogItemSchema } from "@platform/http/endpoints/rules";
import { detailsResponseSchema } from "@platform/http/envelopes";
import { z } from "zod";

export const testRuleReqSchema = createTransactionReqSchema;

export const testRuleDataSchema = z.object({
  matched: z.boolean(),
  actions: z.array(catalogItemSchema),
  warnings: z.array(z.string()),
});

export const testRuleSchema = detailsResponseSchema(testRuleDataSchema);
