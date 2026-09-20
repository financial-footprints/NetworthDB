import { describe, expect, test } from "bun:test";
import { Account } from "@core/domains/account/entities/account";
import { ParsedEmail } from "@statements/ingest/email/attachments";
import { effectiveMailMatchesAccount } from "@statements/ingest/email/matching";
import {
  exclusiveSearchEndDate,
  parseAccountDateStr,
  utcToday,
} from "@statements/period/account-dates";

const REGALIA_ACCOUNT = Account.create({
  userId: "user-1",
  accountType: "credit_card",
  bank: "hdfc",
  variant: "regalia",
  openingDate: "2022-08-21",
  closingDate: "2023-10-20",
  accountNumber: "acc-1",
  passwords: [],
});

describe("email matching", () => {
  test("matches forwarded regalia statement by MIME date and subject", async () => {
    const raw = [
      "From: statements@hdfcbank.net",
      "To: user@example.com",
      "Subject: Your HDFC Bank - Regalia MasterCard Credit Card Statement",
      "Date: Sat, 16 Sep 2023 10:15:00 +0530",
      "MIME-Version: 1.0",
      'Content-Type: multipart/mixed; boundary="boundary"',
      "",
      "--boundary",
      'Content-Type: application/pdf; name="statement.pdf"',
      "Content-Disposition: attachment; filename=statement.pdf",
      "",
      "%PDF-1.4 sample",
      "--boundary--",
      "",
    ].join("\r\n");

    const parsed = await ParsedEmail.parse(Buffer.from(raw));
    expect(parsed).not.toBeNull();
    if (!parsed) {
      throw new Error("expected parsed email");
    }
    const start = parseAccountDateStr(REGALIA_ACCOUNT.openingDate);
    const closingDate = REGALIA_ACCOUNT.closingDate;
    const end = closingDate
      ? exclusiveSearchEndDate(parseAccountDateStr(closingDate) ?? utcToday())
      : null;

    expect(
      effectiveMailMatchesAccount(
        {
          subject: parsed.subject,
          from: parsed.from,
          received: parsed.received,
          body: parsed.body,
          attachmentNames: parsed.attachmentNames,
          startDate: start,
          endDate: end,
        },
        REGALIA_ACCOUNT
      )
    ).toBe(true);
  });
});
