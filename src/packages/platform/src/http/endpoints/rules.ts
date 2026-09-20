import {
  detailsResponseSchema,
  pageLimitSchema,
  paginatedListResponseSchema,
} from "@platform/http/envelopes";
import { z } from "zod";

export const catalogItemSchema = z.object({ type: z.string().min(1) }).passthrough();

export const ruleIdParamsSchema = z.object({
  ruleId: z.string().uuid(),
});

export const ruleExpressionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({
      op: z.enum(["and", "or"]),
      items: z.array(ruleExpressionSchema).min(1),
    }),
    z.object({ type: z.string().min(1) }).passthrough(),
  ])
);

const ruleDataSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  sortOrder: z.number().int(),
  active: z.boolean(),
  stopProcessing: z.boolean(),
  runOnCreate: z.boolean(),
  title: z.string(),
  description: z.string().nullable(),
  when: ruleExpressionSchema,
  actions: z.array(catalogItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ruleSchema = detailsResponseSchema(ruleDataSchema);
export const ruleListSchema = paginatedListResponseSchema(ruleDataSchema);

export const ruleListQuerySchema = z.object({
  groupId: z.string().uuid(),
  limit: pageLimitSchema({ max: 200, defaultLimit: 200 }),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const createRuleReqSchema = z.object({
  groupId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
  stopProcessing: z.boolean().optional(),
  runOnCreate: z.boolean().optional(),
  when: ruleExpressionSchema,
  actions: z.array(catalogItemSchema),
});

export const patchRuleReqSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
  stopProcessing: z.boolean().optional(),
  runOnCreate: z.boolean().optional(),
  when: ruleExpressionSchema.optional(),
  actions: z.array(catalogItemSchema).optional(),
});
