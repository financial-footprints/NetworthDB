import { z } from "zod";

export { API, type ApiPath } from "@platform/endpoints";

export const API_PREFIX = "/api/v1";
export const REQUEST_ID_HEADER = "X-Request-Id";

export const apiErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  field: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  rayId: z.string().optional(),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
