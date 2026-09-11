import { describe, expect, test } from "bun:test";
import { serializeAccountData } from "@api/routes/accounts/serializer";
import { serializeSources } from "@api/routes/sources/serializer";
import { Account } from "@ndb/core";

function sampleAccount(): Account {
  return new Account(
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "credit_card",
    "onecard",
    null,
    "OneCard",
    "2020-01-15",
    null,
    "sealed.blob.value",
    ["secret"],
    {
      subjects: ["statement"],
      bodyContains: [],
      fromAddresses: [],
    },
    {
      textContains: ["pdf"],
      textNotContains: [],
    },
    "2020-01-15T00:00:00.000Z",
    "2020-01-15T00:00:00.000Z"
  );
}

describe("sensitive backup serializers", () => {
  test("serializeAccountData omits secrets when includeSecrets is false", () => {
    const data = serializeAccountData(sampleAccount(), false);
    expect(data).toMatchObject({
      has_passwords: true,
      has_mail_settings: true,
      has_statement_rules: true,
    });
    expect(data).not.toHaveProperty("passwords");
    expect(data).not.toHaveProperty("mail_rules");
    expect(data).not.toHaveProperty("statement_rules");
  });

  test("serializeAccountData includes secrets when includeSecrets is true", () => {
    const data = serializeAccountData(sampleAccount(), true);
    expect(data).toMatchObject({
      passwords: ["secret"],
      mail_rules: {
        subjects: ["statement"],
        body_contains: [],
        from: [],
      },
      statement_rules: {
        text_contains: ["pdf"],
        text_not_contains: [],
      },
    });
    expect(data).not.toHaveProperty("has_passwords");
  });

  test("serializeSources includes email password when includeSecrets is true", () => {
    const payload = serializeSources(
      {
        sources: [
          {
            id: "email-1",
            type: "email",
            label: "Work",
            host: "imap.example.test",
            port: 993,
            username: "user@example.test",
            password: "imap-secret",
            folder: "INBOX",
            useSsl: true,
          },
        ],
      },
      true
    );
    expect(payload.data.sources[0]).toMatchObject({
      password: "imap-secret",
    });
  });
});
