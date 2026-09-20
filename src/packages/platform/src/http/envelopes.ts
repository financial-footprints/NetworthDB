import { z } from "zod";

type PageLimitOptions = {
  max: number;
  defaultLimit: number;
};

/** Paginated list `limit` query param. Must be at least 1 — `limit: 0` is reserved for server-side unpaginated fetches. */
export function pageLimitSchema({ max, defaultLimit }: PageLimitOptions) {
  return z.coerce.number().int().min(1).max(max).default(defaultLimit);
}

export function paginatedListResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
  });
}

export function detailsResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    data: dataSchema,
  });
}

export function nullableDetailsResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    data: dataSchema.nullable(),
  });
}
