import { describe, expect, test } from "bun:test";
import { Time } from "@ndb/core";
import { API, apiPath } from "@ndb/platform";
import { readApiData, readApiJson } from "@tests/api/helpers/api-response";
import { loginViaApp } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";

const ACCOUNT_NUMBER_SAMPLE = "abc.def";
const TXN_DESCRIPTION = "Coffee shop";

type AccountResponse = {
  id: string;
  label: string;
  accountType: string;
  bank: string;
  hasPasswords: boolean;
  currentBalance?: number;
};

type AccountDetailsResponse = {
  data: AccountResponse;
};

type AccountListResponse = {
  items: AccountResponse[];
  total: number;
};

type SystemAccountsData = {
  items: { id: string; accountType: string }[];
};

describe("accounts routes", () => {
  test("POST /api/v1/accounts creates an account", async () => {
    const { app } = await createTestApp({
      username: "acctuser",
      password: "password123",
    });
    const token = await loginViaApp(app, "acctuser", "password123");

    const response = await app.request(API.accounts.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "HDFC",
        variant: "Regalia",
        accountType: "credit_card",
        openingDate: "2020-01-15",
        accountNumber: ACCOUNT_NUMBER_SAMPLE,
        passwords: ["secret"],
      }),
    });

    expect(response.status).toBe(201);
    const body = await readApiJson<AccountDetailsResponse>(response);
    expect(body.data.bank).toBe("HDFC");
    expect(body.data.accountType).toBe("credit_card");
    expect(body.data.hasPasswords).toBe(true);
  });

  test("GET /api/v1/accounts lists accounts with optional filter", async () => {
    const { app } = await createTestApp({
      username: "listuser",
      password: "password123",
    });
    const token = await loginViaApp(app, "listuser", "password123");

    await app.request(API.accounts.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "ICICI",
        accountType: "bank",
        openingDate: "2019-01-01",
        accountNumber: ACCOUNT_NUMBER_SAMPLE,
        passwords: [],
      }),
    });

    const list = await app.request(`${API.accounts.list}?accountType=bank`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.status).toBe(200);
    const body = await readApiJson<AccountListResponse>(list);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.items.every((item) => item.accountType === "bank")).toBe(true);
    expect(body.items.every((item) => typeof item.currentBalance === "number")).toBe(true);
  });

  test("GET /api/v1/accounts filters by q on label or bank", async () => {
    const { app } = await createTestApp({
      username: "qlistuser",
      password: "password123",
    });
    const token = await loginViaApp(app, "qlistuser", "password123");

    await app.request(API.accounts.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "UniqueAlphaBank",
        accountType: "bank",
        openingDate: "2019-01-01",
        accountNumber: ACCOUNT_NUMBER_SAMPLE,
        passwords: [],
      }),
    });

    await app.request(API.accounts.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "OtherBank",
        accountType: "credit_card",
        openingDate: "2019-01-01",
        accountNumber: ACCOUNT_NUMBER_SAMPLE,
        passwords: [],
      }),
    });

    const list = await app.request(`${API.accounts.list}?q=UniqueAlpha`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.status).toBe(200);
    const body = await readApiJson<AccountListResponse>(list);
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.items.every((item) => item.bank.includes("UniqueAlpha"))).toBe(true);
  });

  test("GET /api/v1/accounts sorts by currentBalance descending", async () => {
    const { app } = await createTestApp({
      username: "sortbaluser",
      password: "password123",
    });
    const token = await loginViaApp(app, "sortbaluser", "password123");

    async function createAccount(bank: string): Promise<string> {
      const response = await app.request(API.accounts.create, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bank,
          accountType: "bank",
          openingDate: "2020-01-01",
          accountNumber: ACCOUNT_NUMBER_SAMPLE,
          passwords: [],
        }),
      });
      expect(response.status).toBe(201);
      const body = await readApiJson<AccountDetailsResponse>(response);
      return body.data.id;
    }

    async function postCredit(accountId: string, amountCredit: number): Promise<void> {
      const system = await app.request(API.accounts.system.get, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const systemBody = await readApiData<SystemAccountsData>(system);
      const unknownId = systemBody.items.find((item) => item.accountType === "unknown")?.id;
      expect(unknownId).toBeDefined();
      const response = await app.request(apiPath(API.accounts.transactions.create, { accountId }), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: "2024-06-01",
          amount: amountCredit,
          sourceAccountId: unknownId,
          destinationAccountId: accountId,
          description: TXN_DESCRIPTION,
        }),
      });
      expect(response.status).toBe(201);
    }

    const lowId = await createAccount("SortBalLowBank");
    const highId = await createAccount("SortBalHighBank");
    await postCredit(lowId, 100_00);
    await postCredit(highId, 500_00);

    const list = await app.request(`${API.accounts.list}?sort=currentBalance&direction=desc`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.status).toBe(200);
    const body = await readApiJson<AccountListResponse>(list);
    const ids = body.items.map((item) => item.id);
    expect(ids.indexOf(highId)).toBeLessThan(ids.indexOf(lowId));
    expect(body.items.find((item) => item.id === highId)?.currentBalance).toBe(500_00);
    expect(body.items.find((item) => item.id === lowId)?.currentBalance).toBe(100_00);
  });

  test("GET /api/v1/accounts list currentBalance matches transactions balance", async () => {
    const { app } = await createTestApp({
      username: "listbalparity",
      password: "password123",
    });
    const token = await loginViaApp(app, "listbalparity", "password123");
    const on = Time.utcTodayIsoDate();

    const create = await app.request(API.accounts.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "BalParityBank",
        accountType: "credit_card",
        openingDate: "2020-01-01",
        accountNumber: ACCOUNT_NUMBER_SAMPLE,
        passwords: [],
      }),
    });
    expect(create.status).toBe(201);
    const accountId = (await readApiJson<AccountDetailsResponse>(create)).data.id;

    const system = await app.request(API.accounts.system.get, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const systemBody = await readApiData<SystemAccountsData>(system);
    const unknownId = systemBody.items.find((item) => item.accountType === "unknown")?.id;
    expect(unknownId).toBeDefined();

    const credit = await app.request(apiPath(API.accounts.transactions.create, { accountId }), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: on,
        amount: 250_50,
        sourceAccountId: unknownId,
        destinationAccountId: accountId,
        description: TXN_DESCRIPTION,
      }),
    });
    expect(credit.status).toBe(201);

    const balanceRes = await app.request(
      `${apiPath(API.accounts.transactions.balance, { accountId })}?on=${on}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(balanceRes.status).toBe(200);
    const balanceBody = await readApiData<{ on: string; balance: number }>(balanceRes);

    const list = await app.request(API.accounts.list, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.status).toBe(200);
    const listBody = await readApiJson<AccountListResponse>(list);
    const listItem = listBody.items.find((item) => item.id === accountId);
    expect(listItem?.currentBalance).toBe(balanceBody.balance);
    expect(listItem?.currentBalance).toBe(250_50);
  });

  test("PATCH and DELETE /api/v1/accounts/:id", async () => {
    const { app } = await createTestApp({
      username: "patchuser",
      password: "password123",
    });
    const token = await loginViaApp(app, "patchuser", "password123");

    const create = await app.request(API.accounts.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "PNB",
        accountType: "credit_card",
        openingDate: "2021-05-01",
        accountNumber: ACCOUNT_NUMBER_SAMPLE,
        passwords: ["one"],
      }),
    });
    const created = await readApiJson<AccountDetailsResponse>(create);

    const patch = await app.request(apiPath(API.accounts.patch, { accountId: created.data.id }), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "PNB One",
      }),
    });
    expect(patch.status).toBe(200);
    const patched = await readApiJson<AccountDetailsResponse>(patch);
    expect(patched.data.bank).toBe("PNB One");

    const del = await app.request(apiPath(API.accounts.delete, { accountId: created.data.id }), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(del.status).toBe(204);
  });

  test("GET /api/v1/accounts requires authentication", async () => {
    const { app } = await createTestApp();

    const response = await app.request(API.accounts.list);
    expect(response.status).toBe(401);
  });

  test("GET /api/v1/accounts/system returns four accounts", async () => {
    const { app } = await createTestApp({ username: "sysuser", password: "password123" });
    const token = await loginViaApp(app, "sysuser", "password123");
    const response = await app.request(API.accounts.system.get, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    const { items } = await readApiData<SystemAccountsData>(response);
    expect(items).toHaveLength(4);
  });

  test("GET /api/v1/accounts hides closed accounts by default", async () => {
    const { app } = await createTestApp({
      username: "closeduser",
      password: "password123",
    });
    const token = await loginViaApp(app, "closeduser", "password123");
    const created = await app.request(API.accounts.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "OldLoan",
        accountType: "loan",
        openingDate: "2018-01-01",
        closingDate: "2019-01-01",
        accountNumber: ACCOUNT_NUMBER_SAMPLE,
        passwords: [],
      }),
    });
    expect(created.status).toBe(201);
    const createdBody = await readApiJson<AccountDetailsResponse>(created);

    const openList = await app.request(API.accounts.list, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const openBody = await readApiJson<AccountListResponse>(openList);
    expect(openBody.items.some((item) => item.id === createdBody.data.id)).toBe(false);

    const closedList = await app.request(`${API.accounts.list}?status=closed`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const closedBody = await readApiJson<AccountListResponse>(closedList);
    expect(closedBody.items.some((item) => item.id === createdBody.data.id)).toBe(true);
  });
});
