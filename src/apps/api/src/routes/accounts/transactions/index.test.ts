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

async function systemUnknownId(app: ReturnType<typeof createApp>, token: string): Promise<string> {
  const response = await app.request(API.accounts.system.get, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status).toBe(200);
  const body = await readSystemAccountsData(response);
  return systemAccountId(body.items, "unknown");
}

async function systemExpenseId(app: ReturnType<typeof createApp>, token: string): Promise<string> {
  const response = await app.request(API.accounts.system.get, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await readSystemAccountsData(response);
  return systemAccountId(body.items, "expense");
}

describe("transactions routes", () => {
  test("POST and GET transactions for an account", async () => {
    const { app } = await createTestApp({ username: "txnuser", password: "password123" });
    const token = await loginViaApp(app, "txnuser", "password123");

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
          sourceAccountId: unknownId,
          destinationAccountId: account.data.id,
          description: "Coffee shop",
        }),
      }
    );
    expect(createTxn.status).toBe(201);
    const created = await readApiJson<{
      data: {
        amount: number;
        source: { accountType: string };
        destination: { id: string };
      };
    }>(createTxn);
    expect(created.data.amount).toBe(5000);
    expect(created.data.source.accountType).toBe("unknown");
    expect(created.data.destination.id).toBe(account.data.id);

    const list = await app.request(
      `${apiPath(API.accounts.transactions.list, { accountId: account.data.id })}?from=2024-06-01&to=2024-06-30`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(list.status).toBe(200);
    const body = await readApiJson<{ items: unknown[] }>(list);
    expect(body.items.length).toBeGreaterThanOrEqual(1);
  });

  test("GET transaction list paginates newest date first", async () => {
    const { app } = await createTestApp({
      username: "txnpageuser",
      password: "password123",
    });
    const token = await loginViaApp(app, "txnpageuser", "password123");

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
        accountNumber: "9999999999",
        passwords: [],
      }),
    });
    expect(createAccount.status).toBe(201);
    const account = await readApiJson<{ data: { id: string } }>(createAccount);
    const accountId = account.data.id;
    const unknownId = await systemUnknownId(app, token);
    const listPath = apiPath(API.accounts.transactions.list, { accountId });
    const createPath = apiPath(API.accounts.transactions.create, { accountId });

    for (const [date, amount] of [
      ["2024-08-01", 100],
      ["2024-08-20", 200],
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
          sourceAccountId: unknownId,
          destinationAccountId: accountId,
          description: "Coffee shop",
        }),
      });
      expect(res.status).toBe(201);
    }

    const page1 = await app.request(`${listPath}?from=2024-08-01&to=2024-08-31&limit=1&offset=0`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(page1.status).toBe(200);
    const body1 = await readApiJson<{ items: { date: string }[]; total: number }>(page1);
    expect(body1.total).toBeGreaterThanOrEqual(2);
    expect(body1.items).toHaveLength(1);
    expect(body1.items[0].date).toBe("2024-08-20");

    const page2 = await app.request(`${listPath}?from=2024-08-01&to=2024-08-31&limit=1&offset=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(page2.status).toBe(200);
    const body2 = await readApiJson<{ items: { date: string }[] }>(page2);
    expect(body2.items[0].date).toBe("2024-08-01");
  });

  test("GET transaction list without dates returns rows outside a bounded month", async () => {
    const { app } = await createTestApp({ username: "txnalluser", password: "password123" });
    const token = await loginViaApp(app, "txnalluser", "password123");

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
        accountNumber: "8888888888",
        passwords: [],
      }),
    });
    const account = await readApiJson<{ data: { id: string } }>(createAccount);
    const accountId = account.data.id;
    const unknownId = await systemUnknownId(app, token);
    const listPath = apiPath(API.accounts.transactions.list, { accountId });
    const createPath = apiPath(API.accounts.transactions.create, { accountId });

    for (const [date, amount] of [
      ["2024-08-01", 100],
      ["2023-05-01", 200],
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
          sourceAccountId: unknownId,
          destinationAccountId: accountId,
          description: "Coffee shop",
        }),
      });
      expect(res.status).toBe(201);
    }

    const bounded = await app.request(`${listPath}?from=2024-08-01&to=2024-08-31`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const boundedBody = await readApiJson<{ total: number }>(bounded);
    expect(boundedBody.total).toBe(1);

    const unbounded = await app.request(listPath, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const unboundedBody = await readApiJson<{ total: number }>(unbounded);
    expect(unboundedBody.total).toBe(2);
  });

  test("PATCH transaction updates accounts and 404s on wrong page account", async () => {
    const { app } = await createTestApp({
      username: "txnpatchuser",
      password: "password123",
    });
    const token = await loginViaApp(app, "txnpatchuser", "password123");
    const createdAccount = await app.request(API.accounts.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "HDFC",
        accountType: "bank",
        openingDate: "2020-01-01",
        accountNumber: "111",
        passwords: [],
      }),
    });
    const account = await readApiJson<{ data: { id: string } }>(createdAccount);
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
          date: "2024-09-01",
          amount: 10,
          sourceAccountId: account.data.id,
          destinationAccountId: unknownId,
          description: "Coffee shop",
        }),
      }
    );
    const txn = await readApiJson<{ data: { id: string } }>(createTxn);
    const expenseId = await systemExpenseId(app, token);
    const patchPath = apiPath(API.accounts.transactions.patch, {
      accountId: account.data.id,
      transactionId: txn.data.id,
    });
    const patched = await app.request(patchPath, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: "2024-09-02",
        amount: 12,
        sourceAccountId: account.data.id,
        destinationAccountId: expenseId,
        description: "Coffee shop",
        refNo: null,
      }),
    });
    expect(patched.status).toBe(200);

    const wrong = await app.request(
      apiPath(API.accounts.transactions.patch, {
        accountId: unknownId,
        transactionId: txn.data.id,
      }),
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: "2024-09-02",
          amount: 12,
          sourceAccountId: account.data.id,
          destinationAccountId: expenseId,
          description: "Coffee shop",
        }),
      }
    );
    expect(wrong.status).toBe(404);
  });

  test("POST bulk updates several transactions and rejects an illegal pair", async () => {
    const { app } = await createTestApp({ username: "txnbulk", password: "password123" });
    const token = await loginViaApp(app, "txnbulk", "password123");
    const createdAccount = await app.request(API.accounts.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "HDFC",
        accountType: "bank",
        openingDate: "2020-01-01",
        accountNumber: "222",
        passwords: [],
      }),
    });
    const account = await readApiJson<{ data: { id: string } }>(createdAccount);
    const unknownId = await systemUnknownId(app, token);
    const expenseId = await systemExpenseId(app, token);

    async function createTxn(description: string) {
      const response = await app.request(
        apiPath(API.accounts.transactions.create, { accountId: account.data.id }),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            date: "2024-10-01",
            amount: 40,
            sourceAccountId: account.data.id,
            destinationAccountId: unknownId,
            description,
          }),
        }
      );
      expect(response.status).toBe(201);
      return readApiJson<{ data: { id: string; description: string } }>(response);
    }

    const first = await createTxn("Alpha");
    const second = await createTxn("Beta");
    const bulkPath = apiPath(API.accounts.transactions.bulk, { accountId: account.data.id });
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const updated = await app.request(bulkPath, {
      method: "POST",
      headers,
      body: JSON.stringify({
        items: [
          {
            id: first.data.id,
            date: "2024-10-01",
            amount: 40,
            sourceAccountId: account.data.id,
            destinationAccountId: expenseId,
            description: "Alpha edited",
            refNo: null,
            categoryId: null,
            subcategoryId: null,
            tagIds: [],
          },
          {
            id: second.data.id,
            date: "2024-10-01",
            amount: 40,
            sourceAccountId: account.data.id,
            destinationAccountId: expenseId,
            description: "Beta",
            refNo: null,
            categoryId: null,
            subcategoryId: null,
            tagIds: [],
          },
        ],
      }),
    });
    expect(updated.status).toBe(200);
    const body = await readApiJson<{ data: { updated: number } }>(updated);
    expect(body.data.updated).toBe(2);

    const rejected = await app.request(bulkPath, {
      method: "POST",
      headers,
      body: JSON.stringify({
        items: [
          {
            id: first.data.id,
            date: "2024-10-01",
            amount: 40,
            sourceAccountId: account.data.id,
            destinationAccountId: account.data.id,
            description: "Should not save",
          },
        ],
      }),
    });
    expect(rejected.status).toBe(400);

    const list = await app.request(
      apiPath(API.accounts.transactions.list, { accountId: account.data.id }),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const listed = await readApiJson<{
      items: Array<{ id: string; description: string; destination: { id: string } }>;
    }>(list);
    const savedFirst = listed.items.find((item) => item.id === first.data.id);
    expect(savedFirst?.description).toBe("Alpha edited");
    expect(savedFirst?.destination.id).toBe(expenseId);
  });

  test("DELETE one transaction and POST bulk-delete several", async () => {
    const { app } = await createTestApp({ username: "txndel", password: "password123" });
    const token = await loginViaApp(app, "txndel", "password123");
    const createdAccount = await app.request(API.accounts.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bank: "HDFC",
        accountType: "credit_card",
        openingDate: "2020-01-01",
        accountNumber: "333",
        passwords: [],
      }),
    });
    const account = await readApiJson<{ data: { id: string } }>(createdAccount);
    const unknownId = await systemUnknownId(app, token);
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    async function createTxn(description: string) {
      const response = await app.request(
        apiPath(API.accounts.transactions.create, { accountId: account.data.id }),
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            date: "2024-11-01",
            amount: 20,
            sourceAccountId: account.data.id,
            destinationAccountId: unknownId,
            description,
          }),
        }
      );
      expect(response.status).toBe(201);
      return readApiJson<{ data: { id: string } }>(response);
    }

    const single = await createTxn("Solo");
    const first = await createTxn("One");
    const second = await createTxn("Two");
    const keep = await createTxn("Stay");

    const removed = await app.request(
      apiPath(API.accounts.transactions.delete, {
        accountId: account.data.id,
        transactionId: single.data.id,
      }),
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    expect(removed.status).toBe(204);

    const bulk = await app.request(
      apiPath(API.accounts.transactions.bulkDelete, { accountId: account.data.id }),
      {
        method: "POST",
        headers,
        body: JSON.stringify({ ids: [first.data.id, second.data.id] }),
      }
    );
    expect(bulk.status).toBe(200);
    const body = await readApiJson<{ data: { deleted: number } }>(bulk);
    expect(body.data.deleted).toBe(2);

    const list = await app.request(
      apiPath(API.accounts.transactions.list, { accountId: account.data.id }),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const listed = await readApiJson<{ items: Array<{ id: string }> }>(list);
    const ids = listed.items.map((item) => item.id);
    expect(ids).not.toContain(single.data.id);
    expect(ids).not.toContain(first.data.id);
    expect(ids).not.toContain(second.data.id);
    expect(ids).toContain(keep.data.id);
  });

  test("POST create returns 200 with null data when rule deletes transaction", async () => {
    const { app } = await createTestApp({
      username: "txnruledel",
      password: "password123",
    });
    const token = await loginViaApp(app, "txnruledel", "password123");

    const groupRes = await app.request(API.ruleGroups.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Delete group" }),
    });
    const group = await readApiJson<{ data: { id: string } }>(groupRes);

    await app.request(API.rules.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId: group.data.id,
        title: "Delete coffee",
        when: { op: "and", items: [{ type: "description_contains", value: "coffee" }] },
        actions: [{ type: "delete_transaction" }],
      }),
    });

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
        accountNumber: "del-1",
        passwords: [],
      }),
    });
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
    expect(createTxn.status).toBe(200);
    const deleted = await readApiData<null>(createTxn);
    expect(deleted).toBeNull();
  });

  test("POST create returns 201 with expense destination when rule matches", async () => {
    const { app } = await createTestApp({
      username: "txnrulemut",
      password: "password123",
    });
    const token = await loginViaApp(app, "txnrulemut", "password123");

    const groupRes = await app.request(API.ruleGroups.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Classify group" }),
    });
    const group = await readApiJson<{ data: { id: string } }>(groupRes);

    await app.request(API.rules.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId: group.data.id,
        title: "To expense",
        when: {
          op: "and",
          items: [{ type: "description_contains", value: "coffee" }, { type: "pair_is_spend" }],
        },
        actions: [{ type: "set_destination_system", accountType: "expense" }],
      }),
    });

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
        accountNumber: "mut-1",
        passwords: [],
      }),
    });
    const account = await readApiJson<{ data: { id: string } }>(createAccount);
    const unknownId = await systemUnknownId(app, token);
    const expenseId = await systemExpenseId(app, token);

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
    const created = await readApiJson<{
      data: {
        destination: { id: string; accountType: string };
      };
    }>(createTxn);
    expect(created.data.destination.id).toBe(expenseId);
    expect(created.data.destination.accountType).toBe("expense");
  });

  test("PATCH does not run on-create delete rule", async () => {
    const { app } = await createTestApp({
      username: "txnnorulepatch",
      password: "password123",
    });
    const token = await loginViaApp(app, "txnnorulepatch", "password123");

    const groupRes = await app.request(API.ruleGroups.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Patch safe" }),
    });
    const group = await readApiJson<{ data: { id: string } }>(groupRes);

    await app.request(API.rules.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId: group.data.id,
        title: "Delete on create",
        when: { op: "and", items: [{ type: "description_contains", value: "coffee" }] },
        actions: [{ type: "delete_transaction" }],
      }),
    });

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
        accountNumber: "patch-1",
        passwords: [],
      }),
    });
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
          date: "2024-09-01",
          amount: 10,
          sourceAccountId: account.data.id,
          destinationAccountId: unknownId,
          description: "Groceries",
        }),
      }
    );
    expect(createTxn.status).toBe(201);
    const txn = await readApiJson<{ data: { id: string } }>(createTxn);

    const patchPath = apiPath(API.accounts.transactions.patch, {
      accountId: account.data.id,
      transactionId: txn.data.id,
    });
    const patched = await app.request(patchPath, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: "2024-09-01",
        amount: 10,
        sourceAccountId: account.data.id,
        destinationAccountId: unknownId,
        description: "Coffee shop",
        refNo: null,
      }),
    });
    expect(patched.status).toBe(200);
  });

  test("POST batch creates rows for an import", async () => {
    const { app } = await createTestApp({ username: "txnbatch", password: "password123" });
    const token = await loginViaApp(app, "txnbatch", "password123");

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
        accountNumber: "batch-1",
        passwords: [],
      }),
    });
    const account = await readApiJson<{ data: { id: string } }>(createAccount);
    const accountId = account.data.id;
    const expenseId = await systemExpenseId(app, token);

    const importRes = await app.request(
      apiPath(API.accounts.transactionImports.create, { accountId }),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    expect(importRes.status).toBe(201);
    const importRow = await readApiData<{ id: string }>(importRes);

    const batchRes = await app.request(apiPath(API.accounts.transactions.batch, { accountId }), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        importId: importRow.id,
        items: [
          {
            date: "2024-07-01",
            amount: 100,
            sourceAccountId: accountId,
            destinationAccountId: expenseId,
            description: "Batch A",
          },
          {
            date: "2024-07-02",
            amount: 200,
            sourceAccountId: accountId,
            destinationAccountId: expenseId,
            description: "Batch B",
          },
        ],
      }),
    });
    expect(batchRes.status).toBe(201);
    const batchBody = await readApiJson<{ items: unknown[]; total: number }>(batchRes);
    expect(batchBody.total).toBe(2);
    expect(batchBody.items).toHaveLength(2);
  });

  test("DELETE import removes batch rows", async () => {
    const { app } = await createTestApp({ username: "txnimdel", password: "password123" });
    const token = await loginViaApp(app, "txnimdel", "password123");

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
        accountNumber: "import-del",
        passwords: [],
      }),
    });
    const account = await readApiJson<{ data: { id: string } }>(createAccount);
    const accountId = account.data.id;
    const unknownId = await systemUnknownId(app, token);

    const importRes = await app.request(
      apiPath(API.accounts.transactionImports.create, { accountId }),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const importRow = await readApiData<{ id: string }>(importRes);

    await app.request(apiPath(API.accounts.transactions.batch, { accountId }), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        importId: importRow.id,
        items: [
          {
            date: "2024-08-01",
            amount: 50,
            sourceAccountId: accountId,
            destinationAccountId: unknownId,
            description: "Import row",
          },
        ],
      }),
    });

    const delImport = await app.request(
      apiPath(API.accounts.transactionImports.delete, {
        accountId,
        importId: importRow.id,
      }),
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    expect(delImport.status).toBe(204);

    const list = await app.request(
      `${apiPath(API.accounts.transactions.list, { accountId })}?from=2024-08-01&to=2024-08-31`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const listed = await readApiJson<{ total: number }>(list);
    expect(listed.total).toBe(0);
  });

  test("PATCH transactions-sync updates period and unknown account 404", async () => {
    const { app } = await createTestApp({ username: "txnsync", password: "password123" });
    const token = await loginViaApp(app, "txnsync", "password123");

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
        accountNumber: "sync-1",
        passwords: [],
      }),
    });
    const account = await readApiJson<{ data: { id: string } }>(createAccount);
    const accountId = account.data.id;

    const sync = await app.request(
      apiPath(API.accounts.statements.transactionsSync, { accountId }),
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          period: "2024-07",
          transactionsSynced: true,
          transactionsImportId: null,
        }),
      }
    );
    expect(sync.status).toBe(204);

    const missing = await app.request(
      apiPath(API.accounts.statements.transactionsSync, { accountId: crypto.randomUUID() }),
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          period: "2024-07",
          transactionsSynced: false,
          transactionsImportId: null,
        }),
      }
    );
    expect(missing.status).toBe(404);
  });
});
