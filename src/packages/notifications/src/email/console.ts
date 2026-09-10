import type { EmailSender, SendEmailRequest } from "@ndb/core";
import type { Logger } from "@ndb/logger";

export interface ConsoleEmailSenderOptions {
  logger: Logger;
}

export function createConsoleEmailSender(options: ConsoleEmailSenderOptions): EmailSender {
  const { logger } = options;

  return {
    async sendEmail(request: SendEmailRequest): Promise<void> {
      logger.info("notifications.email.console", {
        subject: request.subject,
        to: request.to,
        cc: request.cc,
        bcc: request.bcc,
        bodyLength: request.body.length,
        htmlLength: request.htmlBody?.length ?? 0,
        attachmentCount: request.attachments?.length ?? 0,
        bodyPreview: request.body.slice(0, 200),
      });
    },
  };
}
