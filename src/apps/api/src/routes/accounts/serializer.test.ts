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

describe("serializeAccountData (API wire format)", () => {
  test("serializeAccountData omits secrets when includeSecrets is false", () => {
    const data = serializeAccountData(sampleAccount(), false);
    expect(data).toMatchObject({
      hasPasswords: true,
      hasMailSettings: true,
      hasStatementRules: true,
    });
    expect(data).not.toHaveProperty("passwords");
    expect(data).not.toHaveProperty("mail");
    expect(data).not.toHaveProperty("statement");
  });

  test("serializeAccountData includes secrets when includeSecrets is true", () => {
    const data = serializeAccountData(sampleAccount(), true);
    expect(data).toMatchObject({
      passwords: ["secret"],
      mail: {
        subjects: ["statement"],
        bodyContains: [],
        fromAddresses: [],
      },
      statement: {
        textContains: ["pdf"],
        textNotContains: [],
      },
    });
    expect(data).not.toHaveProperty("hasPasswords");
    expect(data).not.toHaveProperty("hasMailSettings");
    expect(data).not.toHaveProperty("hasStatementRules");
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
