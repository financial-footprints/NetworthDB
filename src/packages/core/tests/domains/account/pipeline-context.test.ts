import { describe, expect, test } from "bun:test";
import { Account } from "@core/domains/account/entities/account";
import {
  createPipelineContext,
  type PipelineContext,
} from "@core/domains/account/modules/statements/embedded/pipeline-context";
import { JobScope } from "@core/domains/jobs/embedded/scope";
import type { EmailSource } from "@core/domains/sources/entities/sources";

describe("PipelineContext", () => {
  test("createPipelineContext builds scope from JobScope", () => {
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
    const context = createPipelineContext({
      userId: "user-1",
      jobScope: JobScope.create({ accountId: account.id }),
      accounts: [account],
      sources: [source],
    });

    expect(context.accounts[0]?.id).toBe(account.id);
    expect(context.sources[0]?.type).toBe("email");
    expect(context.scope.accountId).toBe(account.id);
  });

  test("PipelineContext carries accounts and sources without adapter types", () => {
    const context: PipelineContext = {
      userId: "user-1",
      scope: { accountId: null, financialYear: null },
      accounts: [],
      sources: [],
    };

    expect(context.scope.accountId).toBeNull();
  });
});
