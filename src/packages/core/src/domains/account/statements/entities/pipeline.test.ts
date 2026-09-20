import { describe, expect, test } from "bun:test";
import { Account } from "@core/domains/account/entities/account";
import { PipelineRun } from "@core/domains/account/statements/entities/pipeline";
import type { EmailSource } from "@core/domains/sources/entities/sources";

describe("PipelineRun", () => {
  test("createSync holds one account and sources", () => {
    const account = Account.create({
      userId: "user-1",
      accountType: "credit_card",
      bank: "onecard",
      openingDate: "2020-01-01",
      accountNumber: "acc-1",
      passwords: [],
    });
    const source: EmailSource = {
      id: "src-1",
      type: "email",
      label: "Inbox",
      host: "imap.example.com",
      port: 993,
      username: "user",
      password: "secret",
      folder: "INBOX",
      useSsl: true,
    };

    const pipeline = PipelineRun.createSync({
      jobId: "job-1",
      userId: "user-1",
      account,
      sources: [source],
      financialYear: "FY24-2025",
      dataKey: null,
      trace: true,
    });

    expect(pipeline.account.id).toBe(account.id);
    expect(pipeline.sources[0]?.type).toBe("email");
    expect(pipeline.financialYear).toBe("FY24-2025");
    expect(pipeline.trace).toBe(true);
  });
});
