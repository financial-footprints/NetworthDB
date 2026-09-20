import { describe, expect, test } from "bun:test";
import { serializeTransaction } from "@api/routes/accounts/transactions/serializer";
import { Account, Transaction } from "@ndb/core";

function account(
  id: string,
  accountType: "credit_card" | "unknown",
  label: string,
  bank: string,
  variant: string | null
): Account {
  return new Account(
    id,
    "22222222-2222-4222-8222-222222222222",
    accountType,
    bank,
    variant,
    label,
    "2020-01-15",
    null,
    "sealed",
    [],
    null,
    null,
    "2020-01-15T00:00:00.000Z",
    "2020-01-15T00:00:00.000Z"
  );
}

describe("transaction party labels", () => {
  test("prefixes instrument parties with the catalog title", () => {
    const source = account(
      "11111111-1111-4111-8111-111111111111",
      "credit_card",
      "bob (easy)",
      "bob",
      "easy"
    );
    const destination = account(
      "33333333-3333-4333-8333-333333333333",
      "unknown",
      "Unknown",
      "Unknown",
      null
    );
    const txn = new Transaction(
      "44444444-4444-4444-8444-444444444444",
      source.userId,
      "2026-01-01",
      100,
      source.id,
      destination.id,
      "Coffee",
      null,
      null,
      null,
      null,
      [],
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z"
    );
    const body = serializeTransaction(
      txn,
      new Map([
        [source.id, source],
        [destination.id, destination],
      ]),
      new Map(),
      new Map(),
      new Map([["bob/easy", "Easy Shopping"]])
    );
    expect(body.data.source.label).toBe("Credit Card - Easy Shopping");
    expect(body.data.destination.label).toBe("Unknown");
  });
});
