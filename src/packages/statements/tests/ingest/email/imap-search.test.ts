import { describe, expect, test } from "bun:test";
import { buildGmailRawQuery, buildImapSearchCriteria } from "@statements/ingest/email/imap-search";

describe("imap search criteria", () => {
  test("gmail raw query includes subjects and dates when requested", () => {
    const start = new Date(2024, 0, 15);
    const end = new Date(2024, 1, 1);
    const query = buildGmailRawQuery(["Statement"], start, end);
    expect(query).toContain("has:attachment");
    expect(query).toContain('subject:"Statement"');
    expect(query).toContain("after:2024/01/15");
    expect(query).toContain("before:2024/02/01");
  });

  test("gmail imap search includes received date filters when provided", () => {
    const start = new Date(2022, 7, 21);
    const end = new Date(2023, 9, 21);
    const subjects = ["Your HDFC Bank - Regalia MasterCard Credit Card Statement"];
    const plan = buildImapSearchCriteria(subjects, start, "imap.gmail.com", end);
    const raw = plan.criteria.at(-1) ?? "";
    expect(raw).toContain("has:attachment");
    expect(raw).toContain('subject:"Your HDFC Bank - Regalia MasterCard Credit Card Statement"');
    expect(raw).toContain("after:2022/08/21");
    expect(raw).toContain("before:2023/10/21");
  });

  test("non gmail imap search keeps date filters", () => {
    const start = new Date(2022, 7, 21);
    const end = new Date(2023, 9, 21);
    const plan = buildImapSearchCriteria(["Statement"], start, "imap.example.com", end);
    expect(plan.criteria).toContain("SINCE");
    expect(plan.criteria).toContain("21-Aug-2022");
    expect(plan.criteria).toContain("BEFORE");
    expect(plan.criteria).toContain("21-Oct-2023");
  });
});
