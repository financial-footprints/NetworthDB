import { dataEnvelopeSchema } from "@platform/http";
import { z } from "zod";

const advancedSecurityConfigSchema = z.object({
  disabled: z.boolean(),
});

const configDataSchema = z.object({
  advanced_security: advancedSecurityConfigSchema,
});

export const configSchema = dataEnvelopeSchema(configDataSchema);
