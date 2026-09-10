import type { EmailSender, SendEmailRequest } from "@core/ports/email";

export class CapturingEmailSender implements EmailSender {
  readonly messages: SendEmailRequest[] = [];

  async sendEmail(request: SendEmailRequest): Promise<void> {
    this.messages.push(request);
  }

  clearMessages(): void {
    this.messages.length = 0;
  }
}

export function tokenFromEmail(body: string): string {
  const lines = body.split("\n");
  const tokenIndex = lines.indexOf("Token:");
  const token = tokenIndex >= 0 ? lines[tokenIndex + 1] : undefined;
  if (!token) {
    throw new Error("token not found in email body");
  }

  return token;
}
