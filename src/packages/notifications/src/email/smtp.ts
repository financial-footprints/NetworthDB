import type { EmailSender, Logger, SendEmailRequest } from "@ndb/core";
import nodemailer, { type SendMailOptions } from "nodemailer";

export interface SmtpEmailSenderOptions {
  host: string;
  port: number;
  from: string;
  logger: Logger;
}

function joinAddresses(addresses?: string[]): string | undefined {
  if (!addresses?.length) {
    return undefined;
  }

  return addresses.join(", ");
}

function toSmtpMailOptions(from: string, request: SendEmailRequest): SendMailOptions {
  const mail: SendMailOptions = {
    from,
    to: request.to.join(", "),
    subject: request.subject,
    text: request.body,
  };

  const cc = joinAddresses(request.cc);
  if (cc) {
    mail.cc = cc;
  }

  const bcc = joinAddresses(request.bcc);
  if (bcc) {
    mail.bcc = bcc;
  }

  if (request.htmlBody) {
    mail.html = request.htmlBody;
  }

  if (request.attachments?.length) {
    mail.attachments = request.attachments.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    }));
  }

  return mail;
}

export function createSmtpEmailSender(options: SmtpEmailSenderOptions): EmailSender {
  const { logger } = options;
  const transporter = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: false,
  });

  return {
    async sendEmail(request: SendEmailRequest): Promise<void> {
      try {
        await transporter.sendMail(toSmtpMailOptions(options.from, request));
        logger.info("notifications.email.smtp.send.success", {});
      } catch (cause) {
        throw new Error("notifications.email.smtp.send.error", {
          cause: cause instanceof Error ? cause : undefined,
        });
      }
    },
  };
}
