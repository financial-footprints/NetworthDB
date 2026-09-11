import { requiredTrimmedString } from "@platform/fields";
import { dataEnvelopeSchema } from "@platform/http";
import { z } from "zod";

const thunderbirdSourceWriteSchema = z
  .object({
    id: requiredTrimmedString("api.sources.invalid.id-required"),
    type: z.literal("thunderbird"),
    label: z.string().optional(),
    profile: requiredTrimmedString("api.sources.invalid.profile-required"),
  })
  .strict();

const emailSourceWriteSchema = z
  .object({
    id: requiredTrimmedString("api.sources.invalid.id-required"),
    type: z.literal("email"),
    label: z.string().optional(),
    host: requiredTrimmedString("api.sources.invalid.host-required"),
    port: z.number().int().optional(),
    username: requiredTrimmedString("api.sources.invalid.username-required"),
    password: z.string().optional(),
    folder: z.string().optional(),
    use_ssl: z.boolean().optional(),
  })
  .strict();

const sourceWriteSchema = z.discriminatedUnion("type", [
  thunderbirdSourceWriteSchema,
  emailSourceWriteSchema,
]);

export const putSourcesReqSchema = z
  .object({
    sources: z.array(sourceWriteSchema).default([]),
  })
  .transform((body) => ({
    sources: body.sources.map((source) => {
      if (source.type === "thunderbird") {
        return {
          id: source.id,
          type: "thunderbird" as const,
          label: source.label,
          profile: source.profile,
        };
      }

      return {
        id: source.id,
        type: "email" as const,
        label: source.label,
        host: source.host,
        port: source.port,
        username: source.username,
        password: source.password,
        folder: source.folder,
        useSsl: source.use_ssl,
      };
    }),
  }));

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
  use_ssl: z.boolean(),
  has_password: z.boolean(),
});

const emailSourceSensitiveSchema = emailSourceRedactedSchema
  .omit({
    has_password: true,
  })
  .extend({
    password: z.string(),
  });

const emailSourceSchema = z.union([emailSourceRedactedSchema, emailSourceSensitiveSchema]);

export const sourceSchema = z.union([thunderbirdSourceSchema, emailSourceSchema]);

const sourcesDataSchema = z.object({
  sources: z.array(sourceSchema),
});

export const sourcesSchema = dataEnvelopeSchema(sourcesDataSchema);
