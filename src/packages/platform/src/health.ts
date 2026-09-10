import { dataEnvelopeSchema } from "@platform/http";
import { z } from "zod";

const healthDataSchema = z.object({
  ok: z.boolean(),
});

export const healthResponseSchema = dataEnvelopeSchema(healthDataSchema);
