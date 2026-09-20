import {
  detailsResponseSchema,
  pageLimitSchema,
  paginatedListResponseSchema,
} from "@platform/http/envelopes";
import { z } from "zod";

export const categoryIdParamsSchema = z.object({
  categoryId: z.string().uuid(),
});

const categoryDataSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const categorySchema = detailsResponseSchema(categoryDataSchema);
export const categoryListSchema = paginatedListResponseSchema(categoryDataSchema);

export const categoryListQuerySchema = z.object({
  q: z.string().optional(),
  parentId: z.string().uuid().optional(),
  limit: pageLimitSchema({ max: 200, defaultLimit: 200 }),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const createCategoryReqSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().uuid().nullable(),
});

export const patchCategoryReqSchema = z.object({
  name: z.string().min(1),
});
