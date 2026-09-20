import { describe, expect, test } from "bun:test";
import type { createApp } from "@ndb/api";
import { API, apiPath } from "@ndb/platform";
import {
  readApiData,
  readApiJson,
  readSystemAccountsData,
  systemAccountId,
} from "@tests/api/helpers/api-response";
import { loginViaApp } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";

async function fetchSystemAccountId(
  app: ReturnType<typeof createApp>,
  token: string,
  type: string
): Promise<string> {
  const response = await app.request(API.accounts.system.get, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await readSystemAccountsData(response);
  return systemAccountId(body.items, type);
}

async function createBankAccount(
  app: ReturnType<typeof createApp>,
  token: string
): Promise<string> {
  const response = await app.request(API.accounts.create, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bank: "HDFC",
      accountType: "bank",
      openingDate: "2020-01-01",
      accountNumber: "1111222233",
      passwords: [],
    }),
  });
  return (await readApiData<{ id: string }>(response)).id;
}

describe("rules test route", () => {
  test("POST test matching description returns actions", async () => {
    const { app } = await createTestApp({
      username: "rules_test_match",
      password: "password123",
    });
    const token = await loginViaApp(app, "rules_test_match", "password123");
    const accountId = await createBankAccount(app, token);
    const unknownId = await fetchSystemAccountId(app, token, "unknown");

    const groupRes = await app.request(API.ruleGroups.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Test group" }),
    });
    const group = await readApiData<{ id: string }>(groupRes);

    const ruleRes = await app.request(API.rules.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId: group.id,
        title: "Desc match",
        when: { op: "and", items: [{ type: "description_contains", value: "coffee" }] },
        actions: [{ type: "set_description", value: "Tagged" }],
      }),
    });
    const rule = await readApiData<{ id: string }>(ruleRes);

    const testRes = await app.request(apiPath(API.rules.test, { ruleId: rule.id }), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: "2024-06-01",
        amount: 100,
        sourceAccountId: accountId,
        destinationAccountId: unknownId,
        description: "coffee shop",
      }),
    });
    expect(testRes.status).toBe(200);
    const body = await readApiData<{
      matched: boolean;
      actions: { type: string }[];
    }>(testRes);
    expect(body.matched).toBe(true);
    expect(body.actions.length).toBeGreaterThan(0);

    const list = await app.request(
      `${apiPath(API.accounts.transactions.list, { accountId })}?from=2024-06-01&to=2024-06-30`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const listBody = await readApiJson<{ items: unknown[] }>(list);
    expect(listBody.items.length).toBe(0);
  });

  test("POST test non-matching returns empty actions", async () => {
    const { app } = await createTestApp({
      username: "rules_test_nomatch",
      password: "password123",
    });
    const token = await loginViaApp(app, "rules_test_nomatch", "password123");
    const accountId = await createBankAccount(app, token);
    const unknownId = await fetchSystemAccountId(app, token, "unknown");

    const groupRes = await app.request(API.ruleGroups.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Test group" }),
    });
    const group = await readApiData<{ id: string }>(groupRes);

    const ruleRes = await app.request(API.rules.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId: group.id,
        title: "Desc match",
        when: { op: "and", items: [{ type: "description_contains", value: "coffee" }] },
        actions: [{ type: "set_description", value: "Tagged" }],
      }),
    });
    const rule = await readApiData<{ id: string }>(ruleRes);

    const testRes = await app.request(apiPath(API.rules.test, { ruleId: rule.id }), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: "2024-06-01",
        amount: 100,
        sourceAccountId: accountId,
        destinationAccountId: unknownId,
        description: "Tea House",
      }),
    });
    expect(testRes.status).toBe(200);
    const body = await readApiData<{ matched: boolean; actions: unknown[] }>(testRes);
    expect(body.matched).toBe(false);
    expect(body.actions).toEqual([]);
  });

  test("POST test unknown rule id returns 404", async () => {
    const { app } = await createTestApp({
      username: "rules_test_404",
      password: "password123",
    });
    const token = await loginViaApp(app, "rules_test_404", "password123");

    const response = await app.request(
      apiPath(API.rules.test, { ruleId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" }),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: "2024-06-01",
          amount: 100,
          sourceAccountId: crypto.randomUUID(),
          destinationAccountId: crypto.randomUUID(),
          description: "x",
        }),
      }
    );
    expect(response.status).toBe(404);
  });
});
