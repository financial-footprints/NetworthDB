import { detailsResponseSchema } from "@platform/http/envelopes";
import { requiredTrimmedString } from "@platform/schema/fields";
import { z } from "zod";

const thunderbirdSourceWriteSchema = z
  .object({
    id: requiredTrimmedString("Source id is required."),
    type: z.literal("thunderbird"),
    label: z.string().optional(),
    profile: requiredTrimmedString("Profile is required."),
  })
  .strict();

const emailSourceWriteSchema = z
  .object({
    id: requiredTrimmedString("Source id is required."),
    type: z.literal("email"),
    label: z.string().optional(),
    host: requiredTrimmedString("Host is required."),
    port: z.number().int().optional(),
    username: requiredTrimmedString("Username is required."),
    password: z.string().optional(),
    folder: z.string().optional(),
    useSsl: z.boolean().optional(),
  })
  .strict();

const sourceWriteSchema = z.discriminatedUnion("type", [
  thunderbirdSourceWriteSchema,
  emailSourceWriteSchema,
]);

export const putSourcesReqSchema = z.object({
  sources: z.array(sourceWriteSchema).default([]),
});

const thunderbirdSourceSchema = z.object({
  id: z.string(),
  type: z.literal("thunderbird"),
  label: z.string(),
  profile: z.string(),
});

const emailSourceRedactedSchema = z.object({
  id: z.string(),
  type: z.literal("email"),
  label: z.string(),
  host: z.string(),
  port: z.number().int(),
  username: z.string(),
  folder: z.string(),
  useSsl: z.boolean(),
  hasPassword: z.boolean(),
});

const emailSourceSensitiveSchema = emailSourceRedactedSchema
  .omit({
    hasPassword: true,
  })
  .extend({
    password: z.string(),
  });

const emailSourceSchema = z.union([emailSourceRedactedSchema, emailSourceSensitiveSchema]);

export const sourceSchema = z.union([thunderbirdSourceSchema, emailSourceSchema]);

const sourcesDataSchema = z.object({
  sources: z.array(sourceSchema),
});

export const sourcesSchema = detailsResponseSchema(sourcesDataSchema);
