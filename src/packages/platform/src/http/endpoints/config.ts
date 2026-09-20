import { detailsResponseSchema } from "@platform/http/envelopes";
import { z } from "zod";

const advancedSecurityConfigSchema = z.object({
  disabled: z.boolean(),
});

const configDataSchema = z.object({
  advancedSecurity: advancedSecurityConfigSchema,
});

export const configSchema = detailsResponseSchema(configDataSchema);
