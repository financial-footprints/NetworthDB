import { z } from "zod";

export const REQUEST_ID_HEADER = "X-Request-Id";

export const apiErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  field: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  rayId: z.string().optional(),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

export function dataEnvelopeSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    errors: z.array(z.never()).default([]),
  });
}

export function nullableDataEnvelopeSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    data: dataSchema.nullable(),
    errors: z.array(z.never()).default([]),
  });
}

export function paginatedDataEnvelopeSchema<T extends z.ZodType>(itemSchema: T) {
  return dataEnvelopeSchema(
    z.object({
      items: z.array(itemSchema),
      total: z.number().int().nonnegative(),
    })
  );
}
