import { mkdirSync, writeFileSync } from "node:fs";
import { extname } from "node:path";
import type { Account } from "@ndb/core";
import {
  effectiveMailMatchesAccount,
  effectiveMailRejectReason,
  type MailMatchInput,
  type MailMatchRejectReason,
} from "@statements/ingest/email/matching";
import { sanitizeFilename } from "@statements/ingest/email/message";
import {
  extractStatementsFromZip,
  sanitizeZipMemberName,
  ZipArchiveError,
  ZipNoStatementFilesError,
  ZipPasswordError,
} from "@statements/ingest/zip/index";
import { formatIsoDate } from "@statements/period/iso-date";
import { uniquePath } from "@statements/storage/vault/path";
import { type Attachment, type ParsedMail, simpleParser } from "mailparser";

const PDF_MAGIC = Buffer.from("%PDF");

export class ParsedEmail {
  private readonly mail: ParsedMail;

  private constructor(mail: ParsedMail) {
    this.mail = mail;
  }

  static async parse(raw: Buffer): Promise<ParsedEmail | null> {
    try {
      const mail = await simpleParser(raw);
      return new ParsedEmail(mail);
    } catch {
      return null;
    }
  }

  get subject(): string {
    return this.mail.subject ?? "";
  }

  get from(): string {
    const address = this.mail.from?.value[0]?.address;
    return address ?? "";
  }

  get received(): Date | null {
    const date = this.mail.date;
    if (!date) {
      return null;
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  get body(): string {
    const parts = [this.mail.text ?? "", this.mail.html ?? ""].filter(Boolean);
    return parts.join("\n");
  }

  get attachmentNames(): string[] {
    return (this.mail.attachments ?? [])
      .map((attachment) => sanitizeFilename(attachment.filename ?? "attachment"))
      .filter(Boolean);
  }

  private mailMatchInput(startDate: Date | null, endDate: Date | null): MailMatchInput {
    return {
      subject: this.subject,
      from: this.from,
      received: this.received,
      body: this.body,
      attachmentNames: this.attachmentNames,
      startDate,
      endDate,
    };
  }

  matchesAccount(account: Account, startDate: Date | null, endDate: Date | null): boolean {
    return effectiveMailMatchesAccount(this.mailMatchInput(startDate, endDate), account);
  }

  rejectReason(
    account: Account,
    startDate: Date | null,
    endDate: Date | null
  ): MailMatchRejectReason | null {
    return effectiveMailRejectReason(this.mailMatchInput(startDate, endDate), account);
  }

  async saveAttachments(
    downloadDir: string,
    folderPrefix: string,
    account: Account
  ): Promise<number> {
    return saveAttachmentsFromMail(this.mail, downloadDir, folderPrefix, account);
  }
}

function isAnnualEmail(mail: ParsedMail): boolean {
  const subject = (mail.subject ?? "").toLowerCase();
  if (subject.includes("annual") || subject.includes("year end")) {
    return true;
  }
  const body = `${mail.text ?? ""}\n${mail.html ?? ""}`.toLowerCase();
  return body.includes("annual") || body.includes("year end");
}

function attachmentFilename(mail: ParsedMail, original: string, annual: boolean): string {
  const safeOriginal = sanitizeFilename(original);
  const suffix = extname(safeOriginal).toLowerCase();
  const stem = mailDateStem(mail);
  let resolvedSuffix = suffix;
  if (suffix === ".pdf" || suffix === ".csv") {
    resolvedSuffix = suffix;
  } else if (!suffix && isAnnualEmail(mail)) {
    resolvedSuffix = ".pdf";
  }
  if (annual && resolvedSuffix === ".csv") {
    return `${stem}__annual${resolvedSuffix}`;
  }
  return resolvedSuffix ? `${stem}${resolvedSuffix}` : stem;
}

function mailDateStem(mail: ParsedMail): string {
  const date = mail.date;
  if (!date) {
    return "unknown-date";
  }
  return formatIsoDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
}

function downloadFilenameForExtractedMember(
  mail: ParsedMail,
  innerName: string,
  annual: boolean
): string {
  const stem = mailDateStem(mail);
  const safeInner = sanitizeZipMemberName(innerName);
  return annual ? `${stem}__annual__${safeInner}` : `${stem}__${safeInner}`;
}

function isPdfAttachment(attachment: Attachment, annual: boolean): boolean {
  const filename = sanitizeFilename(attachment.filename ?? "");
  if (filename.toLowerCase().endsWith(".pdf")) {
    return true;
  }
  if ((attachment.contentType ?? "").toLowerCase() === "application/pdf") {
    return true;
  }
  if (annual && (attachment.contentType ?? "").toLowerCase() === "application/octet-stream") {
    return Buffer.from(attachment.content.subarray(0, 4)).equals(PDF_MAGIC);
  }
  return false;
}

function isCsvAttachment(attachment: Attachment): boolean {
  const filename = sanitizeFilename(attachment.filename ?? "").toLowerCase();
  if (filename.endsWith(".csv")) {
    return true;
  }
  const type = (attachment.contentType ?? "").toLowerCase();
  return type === "text/csv" || type === "application/csv" || type === "application/vnd.ms-excel";
}

function isZipAttachment(attachment: Attachment): boolean {
  return sanitizeFilename(attachment.filename ?? "")
    .toLowerCase()
    .endsWith(".zip");
}

function saveDirectAttachment(
  mail: ParsedMail,
  attachment: Attachment,
  downloadDir: string,
  prefix: string,
  annual: boolean
): number {
  const filename = attachment.filename ?? "attachment";
  const isCsv = sanitizeFilename(filename).toLowerCase().endsWith(".csv");
  const safeName = attachmentFilename(mail, filename, annual && isCsv);
  const dest = uniquePath(downloadDir, `${prefix}${safeName}`);
  writeFileSync(dest, attachment.content);
  return 1;
}

async function saveZipAttachment(
  mail: ParsedMail,
  attachment: Attachment,
  downloadDir: string,
  prefix: string,
  account: Account,
  annual: boolean
): Promise<number> {
  try {
    const extracted = await extractStatementsFromZip(attachment.content, account.passwords);
    let saved = 0;
    for (const item of extracted) {
      const safeName = downloadFilenameForExtractedMember(mail, item.innerName, annual);
      const dest = uniquePath(downloadDir, `${prefix}${safeName}`);
      writeFileSync(dest, item.content);
      saved += 1;
    }
    return saved;
  } catch (error) {
    if (
      error instanceof ZipPasswordError ||
      error instanceof ZipNoStatementFilesError ||
      error instanceof ZipArchiveError
    ) {
      return 0;
    }
    throw error;
  }
}

async function saveAttachmentsFromMail(
  mail: ParsedMail,
  downloadDir: string,
  folderPrefix: string,
  account: Account
): Promise<number> {
  mkdirSync(downloadDir, { recursive: true });
  const prefix = folderPrefix ? `${folderPrefix}__` : "";
  const annual = isAnnualEmail(mail);
  let saved = 0;

  for (const attachment of mail.attachments ?? []) {
    if (isPdfAttachment(attachment, annual) || isCsvAttachment(attachment)) {
      saved += saveDirectAttachment(mail, attachment, downloadDir, prefix, annual);
      continue;
    }

    if (isZipAttachment(attachment)) {
      saved += await saveZipAttachment(mail, attachment, downloadDir, prefix, account, annual);
    }
  }

  return saved;
}

export { sanitizeFilename };
