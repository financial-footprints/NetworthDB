import type { Account } from "@ndb/core";
import { getMailSubjects } from "@statements/banks/handlers/index";
import {
  bodyMatches,
  fromMatches,
  messageInDateRange,
  subjectMatches,
} from "@statements/ingest/email/message";

export type EffectiveMailConfig = {
  subjects: string[];
  bodyContains: string[];
  from: string[];
};

export type MailMatchInput = {
  subject: string;
  from: string;
  received: Date | null;
  body: string;
  attachmentNames: string[];
  startDate: Date | null;
  endDate: Date | null;
};

export function effectiveMailForAccount(account: Account): EffectiveMailConfig {
  const defaultSubjects = getMailSubjects(account.bank, account.variant);
  const overlay = account.mail;
  if (!overlay) {
    return { subjects: defaultSubjects, bodyContains: [], from: [] };
  }

  return {
    subjects: overlay.subjects.length > 0 ? overlay.subjects : defaultSubjects,
    bodyContains: overlay.bodyContains,
    from: overlay.fromAddresses,
  };
}

export type MailMatchRejectReason = "subject" | "from" | "date" | "no_attachments" | "body";

export function effectiveMailRejectReason(
  input: MailMatchInput,
  account: Account
): MailMatchRejectReason | null {
  const mail = effectiveMailForAccount(account);
  if (!subjectMatches(input.subject, mail.subjects)) {
    return "subject";
  }
  if (!fromMatches(input.from, mail.from)) {
    return "from";
  }
  if (!messageInDateRange(input.received, input.startDate, input.endDate)) {
    return "date";
  }
  if (input.attachmentNames.length === 0) {
    return "no_attachments";
  }
  if (!bodyMatches(input.body, input.attachmentNames, mail.bodyContains)) {
    return "body";
  }
  return null;
}

export function effectiveMailMatchesAccount(input: MailMatchInput, account: Account): boolean {
  return effectiveMailRejectReason(input, account) === null;
}
