import { type BootstrapEnv, envPort, envUrl, getEnv } from "@bootstrap/config/env";
import type { AppEnv } from "@ndb/core";
import type { EmailChannel, EmailDeliveryConfig } from "@notifications/config";
import { z } from "zod";

const emailChannelSchema = z.enum(["console", "smtp"]);

export type RecoveryConfig = {
  recoveryAppBaseUrl: string | null;
  passwordTokenTtlMs: number;
  advancedTokenTtlMs: number;
  email: EmailDeliveryConfig;
};

function parseEmailChannel(rawChannel: string): EmailChannel {
  const result = emailChannelSchema.safeParse(rawChannel);
  if (!result.success) {
    throw new Error(`bootstrap.config.env.invalid-email-channel.value.${rawChannel}`);
  }

  return result.data;
}

export function loadRecoveryConfig(env: BootstrapEnv, environment: AppEnv): RecoveryConfig {
  const channel = parseEmailChannel(
    env.EMAIL_CHANNEL ?? (environment === "local" ? "console" : "smtp")
  );

  const email: EmailDeliveryConfig =
    channel === "smtp"
      ? {
          channel: "smtp",
          smtp: {
            host: getEnv(env, "SMTP_HOST", z.string(), "required"),
            port: getEnv(env, "SMTP_PORT", envPort, "required"),
            from: getEnv(env, "SMTP_FROM", z.string(), "required"),
          },
        }
      : { channel: "console" };

  return {
    recoveryAppBaseUrl: getEnv(env, "RECOVERY_APP_BASE_URL", envUrl, "optional"),
    passwordTokenTtlMs: env.RECOVERY_PASSWORD_TOKEN_TTL,
    advancedTokenTtlMs: env.RECOVERY_ADVANCED_TOKEN_TTL,
    email,
  };
}
