import {
  detailsResponseSchema,
  pageLimitSchema,
  paginatedListResponseSchema,
} from "@platform/http/envelopes";
import { z } from "zod";

export const tagIdParamsSchema = z.object({
  tagId: z.string().uuid(),
});

const tagDataSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const tagSchema = detailsResponseSchema(tagDataSchema);
export const tagListSchema = paginatedListResponseSchema(tagDataSchema);

export const tagListQuerySchema = z.object({
  q: z.string().optional(),
  limit: pageLimitSchema({ max: 200, defaultLimit: 200 }),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const createTagReqSchema = z.object({
  name: z.string().min(1),
});

export const patchTagReqSchema = z.object({
  name: z.string().min(1),
});
