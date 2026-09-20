import { describe, expect, test } from "bun:test";
import type { createApp } from "@ndb/api";
import { API, apiPath } from "@ndb/platform";
import {
  readApiJson,
  readSystemAccountsData,
  systemAccountId,
} from "@tests/api/helpers/api-response";
import { loginViaApp } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";

async function systemUnknownId(app: ReturnType<typeof createApp>, token: string): Promise<string> {
  const response = await app.request(API.accounts.system.get, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status).toBe(200);
  const body = await readSystemAccountsData(response);
  return systemAccountId(body.items, "unknown");
}

describe("dashboard routes", () => {
  test("GET dashboard requires session and valid range", async () => {
    const { app } = await createTestApp({
      username: "dashuser",
      password: "password123",
    });
    const token = await loginViaApp(app, "dashuser", "password123");

    const unauthorized = await app.request(`${API.dashboard.get}?from=2024-06-01&to=2024-06-30`);
    expect(unauthorized.status).toBe(401);

    const unbounded = await app.request(API.dashboard.get, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(unbounded.status).toBe(200);

    const oneSided = await app.request(`${API.dashboard.get}?from=2024-06-01`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(oneSided.status).toBe(400);

    const inverted = await app.request(`${API.dashboard.get}?from=2024-06-30&to=2024-06-01`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(inverted.status).toBe(400);
  });

  test("GET dashboard returns snapshot after spend", async () => {
    const { app } = await createTestApp({
      username: "dashuser2",
      password: "password123",
    });
    const token = await loginViaApp(app, "dashuser2", "password123");

    const createAccount = await app.request(API.accounts.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "HDFC",
        accountType: "credit_card",
        openingDate: "2020-01-01",
        accountNumber: "1234567890",
        passwords: [],
      }),
    });
    expect(createAccount.status).toBe(201);
    const account = await readApiJson<{ data: { id: string } }>(createAccount);
    const unknownId = await systemUnknownId(app, token);

    const createTxn = await app.request(
      apiPath(API.accounts.transactions.create, { accountId: account.data.id }),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: "2024-06-01",
          amount: 5000,
          sourceAccountId: account.data.id,
          destinationAccountId: unknownId,
          description: "Coffee shop",
        }),
      }
    );
    expect(createTxn.status).toBe(201);

    const dashboard = await app.request(`${API.dashboard.get}?from=2024-06-01&to=2024-06-30`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(dashboard.status).toBe(200);
    const body = await readApiJson<{
      data: {
        cashflow: { spend: number };
        period: { bucket: string };
      };
    }>(dashboard);
    expect(body.data.cashflow.spend).toBe(5000);
    expect(body.data.period.bucket).toBe("day");
  });

  test("GET dashboard without dates includes spend outside a narrow month", async () => {
    const { app } = await createTestApp({ username: "dashuser3", password: "password123" });
    const token = await loginViaApp(app, "dashuser3", "password123");

    const createAccount = await app.request(API.accounts.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "HDFC",
        accountType: "bank",
        openingDate: "2020-01-01",
        accountNumber: "5555555555",
        passwords: [],
      }),
    });
    const account = await readApiJson<{ data: { id: string } }>(createAccount);
    const unknownId = await systemUnknownId(app, token);
    const createPath = apiPath(API.accounts.transactions.create, { accountId: account.data.id });

    for (const [date, amount] of [
      ["2024-06-01", 1000],
      ["2023-01-15", 2000],
    ] as const) {
      const res = await app.request(createPath, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date,
          amount,
          sourceAccountId: account.data.id,
          destinationAccountId: unknownId,
          description: "Spend",
        }),
      });
      expect(res.status).toBe(201);
    }

    const narrow = await app.request(`${API.dashboard.get}?from=2024-06-01&to=2024-06-30`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const narrowBody = await readApiJson<{ data: { cashflow: { spend: number } } }>(narrow);
    expect(narrowBody.data.cashflow.spend).toBe(1000);

    const all = await app.request(API.dashboard.get, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const allBody = await readApiJson<{ data: { cashflow: { spend: number } } }>(all);
    expect(allBody.data.cashflow.spend).toBe(3000);
  });
});
