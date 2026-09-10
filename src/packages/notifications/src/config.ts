import type { AppEnv, EmailSender } from "@ndb/core";
import type { Logger } from "@ndb/logger";
import { createConsoleEmailSender } from "@notifications/email/console";
import { createSmtpEmailSender } from "@notifications/email/smtp";

export type EmailChannel = "console" | "smtp";

export type SmtpOptions = {
  host: string;
  port: number;
  from: string;
};

export type EmailDeliveryConfig = {
  channel: EmailChannel;
  smtp?: SmtpOptions;
};

export type EmailSenderEnv = {
  environment: AppEnv;
  email: EmailDeliveryConfig;
  logger: Logger;
};

export function createEmailSender(config: EmailSenderEnv): EmailSender {
  const { email, logger } = config;

  if (email.channel === "smtp") {
    if (!email.smtp) {
      throw new Error("notifications.config.email-smtp.required");
    }

    return createSmtpEmailSender({ ...email.smtp, logger });
  }

  return createConsoleEmailSender({ logger });
}
