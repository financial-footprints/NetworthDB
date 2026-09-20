import {
  detailsResponseSchema,
  pageLimitSchema,
  paginatedListResponseSchema,
} from "@platform/http/envelopes";
import { z } from "zod";

export const ruleGroupIdParamsSchema = z.object({
  ruleGroupId: z.string().uuid(),
});

const ruleGroupDataSchema = z.object({
  id: z.string().uuid(),
  sortOrder: z.number().int(),
  active: z.boolean(),
  title: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ruleGroupSchema = detailsResponseSchema(ruleGroupDataSchema);
export const ruleGroupListSchema = paginatedListResponseSchema(ruleGroupDataSchema);

export const ruleGroupListQuerySchema = z.object({
  limit: pageLimitSchema({ max: 200, defaultLimit: 200 }),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const createRuleGroupReqSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export const patchRuleGroupReqSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});
