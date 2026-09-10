export interface EmailAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

export interface SendEmailRequest {
  subject: string;
  body: string;
  htmlBody?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  attachments?: EmailAttachment[];
}

export interface EmailSender {
  sendEmail(request: SendEmailRequest): Promise<void>;
}
