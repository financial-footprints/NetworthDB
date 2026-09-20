import {
  emptyToUndefined,
  formatEnvUrlOriginPath,
  parseBoundedInt,
  parseCommaSeparatedValue,
  parseDurationValue,
} from "@bootstrap/config/env/parsers";
import { APP_ENVS, ROLES } from "@ndb/core";
import { z } from "zod";

export const durationMs = z.string().transform(parseDurationValue);

const positiveInt = z
  .string()
  .transform((value) => parseBoundedInt(value, 1, "invalid-positive-int"));

const nonNegativeInt = z
  .string()
  .transform((value) => parseBoundedInt(value, 0, "invalid-non-negative-int"));

export function withEnvDefault<T extends z.ZodType>(schema: T, defaultInput: string) {
  return z.preprocess((value) => emptyToUndefined(value) ?? defaultInput, schema);
}

export const envCommaSeparatedList = z.preprocess((value) => {
  const normalized = emptyToUndefined(value);
  return normalized === undefined ? [] : parseCommaSeparatedValue(normalized as string);
}, z.array(z.string()));

export const nonEmptyString = z.string().min(1);

export const port = z.coerce.number().int().min(1).max(65535);

export const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

export const optionalPort = z.preprocess(emptyToUndefined, port.optional());

export const envPort = port;

export const envUrl = z.string().transform((value) => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`bootstrap.config.env.invalid-url.value.${value}`);
  }

  const protocol = parsed.protocol.replace(":", "");
  if (protocol !== "http" && protocol !== "https") {
    throw new Error(`bootstrap.config.env.invalid-url.protocol.${protocol}`);
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("bootstrap.config.env.invalid-url.unsupported-component");
  }

  return formatEnvUrlOriginPath(parsed);
});

const runtimeEnvSchema = z.object({
  HOST: nonEmptyString,
  PORT: port,
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
  ENVIRONMENT: z.enum(APP_ENVS),
});

const sessionEnvSchema = z.object({
  SESSION_TTL: durationMs,
  REFRESH_TTL: durationMs,
});

const multifactorEnvSchema = z.object({
  MFA_CHALLENGE_TTL: durationMs,
  MFA_LOCKOUT_TTL: durationMs,
  MFA_TOTP_SKEW: withEnvDefault(nonNegativeInt, "1"),
  MFA_MAX_FAILURES: withEnvDefault(positiveInt, "5"),
  MFA_SECRET: optionalString,
  MFA_REQUIRED_ROLES: envCommaSeparatedList.pipe(z.array(z.enum(ROLES))),
});

const securityEnvSchema = z.object({
  AUTH_RATE_LIMIT: withEnvDefault(positiveInt, "20"),
  AUTH_RATE_WINDOW: withEnvDefault(durationMs, "60s").refine((value) => value > 0, {
    message: "bootstrap.config.env.auth-rate-window.must-be-positive",
  }),
  KVSTORE_URL: nonEmptyString,
});

const recoveryEnvSchema = z.object({
  RECOVERY_APP_BASE_URL: optionalString,
  RECOVERY_PASSWORD_TOKEN_TTL: withEnvDefault(durationMs, "1h"),
  RECOVERY_ADVANCED_TOKEN_TTL: withEnvDefault(durationMs, "30m"),
  EMAIL_CHANNEL: optionalString,
  SMTP_HOST: optionalString,
  SMTP_PORT: optionalPort,
  SMTP_FROM: optionalString,
});

const webauthnEnvSchema = z.object({
  WEBAUTHN_RP_ID: optionalString,
  WEBAUTHN_RP_ORIGINS: envCommaSeparatedList,
  WEBAUTHN_RP_DISPLAY_NAME: optionalString,
});

const corsEnvSchema = z.object({
  CORS_ALLOW_ORIGINS: envCommaSeparatedList,
});

const storageEnvSchema = z.object({
  FILESTORE_PATH: optionalString,
  BACKUP_MAX_UPLOAD_BYTES: withEnvDefault(nonNegativeInt, "536870912"),
});

const jobsEnvSchema = z.object({
  JOBS_MAX_WORKERS: withEnvDefault(positiveInt, "10"),
});

const advancedSecurityEnvSchema = z.object({
  DISABLE_ADVANCED_SECURITY: withEnvDefault(
    z.enum(["true", "false"]).transform((value) => value === "true"),
    "false"
  ),
});

export const bootstrapEnvSchema = runtimeEnvSchema
  .extend(sessionEnvSchema.shape)
  .extend(multifactorEnvSchema.shape)
  .extend(securityEnvSchema.shape)
  .extend(recoveryEnvSchema.shape)
  .extend(webauthnEnvSchema.shape)
  .extend(corsEnvSchema.shape)
  .extend(storageEnvSchema.shape)
  .extend(jobsEnvSchema.shape)
  .extend(advancedSecurityEnvSchema.shape);

export type BootstrapEnv = z.infer<typeof bootstrapEnvSchema>;
