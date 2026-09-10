import { emptyToUndefined } from "@bootstrap/config/env/parsers";
import {
  type BootstrapEnv,
  bootstrapEnvSchema,
  durationMs,
  envCommaSeparatedList,
  envPort,
  envUrl,
} from "@bootstrap/config/env/schema";
import { z } from "zod";

type EnvPresence = "optional" | "required" | "required-in-production";

export { type BootstrapEnv, durationMs, envCommaSeparatedList, envPort, envUrl };

function buildGetEnvSchema<T>(
  fieldName: string,
  valueSchema: z.ZodType<T, z.ZodTypeDef, unknown>,
  presence: EnvPresence,
  isProduction: boolean
): z.ZodType<T | null, z.ZodTypeDef, unknown> {
  switch (presence) {
    case "optional":
      return z
        .preprocess((value) => emptyToUndefined(value), z.union([valueSchema, z.undefined()]))
        .transform((value) => value ?? null);

    case "required":
      return z.preprocess((value) => {
        const processed = emptyToUndefined(value);
        if (processed === undefined) {
          throw new Error(`bootstrap.config.env.required.not-found.${fieldName}`);
        }

        return processed;
      }, valueSchema);

    case "required-in-production":
      return z.preprocess(
        (value) => {
          const processed = emptyToUndefined(value);
          if (processed === undefined) {
            if (isProduction) {
              throw new Error(`bootstrap.config.env.production-required.not-found.${fieldName}`);
            }

            return null;
          }

          return processed;
        },
        z.union([valueSchema, z.null()])
      );
  }
}

function throwEnvError(error: unknown, mapRemainingZodError?: (error: z.ZodError) => Error): never {
  if (error instanceof Error && error.message.startsWith("bootstrap.config.")) {
    throw error;
  }

  if (error instanceof z.ZodError) {
    const customIssue = error.issues.find((issue) => issue.message.startsWith("bootstrap.config."));
    if (customIssue) {
      throw new Error(customIssue.message);
    }

    if (mapRemainingZodError) {
      throw mapRemainingZodError(error);
    }
  }

  throw error;
}

type GetEnvResult<P extends EnvPresence, T> = P extends "required" ? T : T | null;

export function getEnv<P extends EnvPresence, T>(
  env: BootstrapEnv,
  fieldName: keyof BootstrapEnv,
  valueSchema: z.ZodType<T, z.ZodTypeDef, unknown>,
  presence: P,
  isProduction = false
): GetEnvResult<P, T> {
  const schema = buildGetEnvSchema(String(fieldName), valueSchema, presence, isProduction);

  try {
    return schema.parse(env[fieldName]) as GetEnvResult<P, T>;
  } catch (error) {
    throwEnvError(error);
  }
}

export function parseEnv(): BootstrapEnv {
  try {
    return bootstrapEnvSchema.parse(process.env);
  } catch (error) {
    throwEnvError(error, (error) => {
      const fields = error.issues.map((issue) => issue.path.join(".")).join(", ");
      return new Error(`bootstrap.config.env.invalid.fields.${fields}`);
    });
  }
}
