import { describe, expect, test } from "bun:test";
import { McpAuthError } from "@mcp/auth/gate";
import { SessionStore } from "@mcp/auth/session-store";
import { createCategoryTools } from "@mcp/tools/categories";
import { createTagTools } from "@mcp/tools/tags";
import { createTransactionTools } from "@mcp/tools/transactions";
import { API } from "@ndb/platform";
import { requireNamed } from "@tests/mcp/require-named";

const API_ORIGIN = "http://127.0.0.1:8000";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const TXN_ID = "00000000-0000-4000-8000-000000000002";
const TAG_ID = "00000000-0000-4000-8000-000000000003";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function tokenPair() {
  return {
    sessionToken: "session-abc",
    refreshToken: "refresh-xyz",
    expiresIn: 3600,
  };
}

function mePayload() {
  return {
    id: "user-1",
    username: "usher",
    role: "user",
    multifactorEnabled: false,
  };
}

type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;

async function loginStore(handler: FetchHandler) {
  const store = new SessionStore({
    apiOrigin: API_ORIGIN,
    fetchImpl: async (url, init) => handler(url, init),
  });
  await store.login({ username: "usher", password: "admin" });
  return store;
}

const txnWriteBody = {
  date: "2024-01-15",
  amount: 50000,
  sourceAccountId: "00000000-0000-4000-8000-000000000010",
  destinationAccountId: "00000000-0000-4000-8000-000000000011",
  description: "Coffee",
  refNo: null,
  categoryId: null,
  subcategoryId: null,
  tagIds: [TAG_ID],
};

describe("createTransactionTools", () => {
  test("transactions_list without session throws McpAuthError", async () => {
    const session = new SessionStore({ apiOrigin: API_ORIGIN });
    const list = requireNamed(createTransactionTools(session), "transactions_list");
    await expect(
      list.handler({
        id: ACCOUNT_ID,
        from: "2024-01-01",
        to: "2024-01-31",
      })
    ).rejects.toBeInstanceOf(McpAuthError);
  });

  test("transactions_list hits GET with from/to query after login", async () => {
    let listUrl = "";
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.includes("/transactions") && init?.method === "GET" && url.includes("from=")) {
        listUrl = url;
        return jsonResponse(200, { data: { items: [], total: 0 } });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const session = await loginStore(handler);
    const list = requireNamed(createTransactionTools(session), "transactions_list");
    await list.handler({ id: ACCOUNT_ID, from: "2024-01-01", to: "2024-01-31" });
    expect(listUrl).toContain("from=2024-01-01");
    expect(listUrl).toContain("to=2024-01-31");
  });

  test("transactions_list without dates omits from and to query params", async () => {
    let listUrl = "";
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.includes("/transactions") && init?.method === "GET" && !url.includes("from=")) {
        listUrl = url;
        return jsonResponse(200, { items: [], total: 0 });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const session = await loginStore(handler);
    const list = requireNamed(createTransactionTools(session), "transactions_list");
    await list.handler({ id: ACCOUNT_ID });
    expect(listUrl).not.toContain("from=");
    expect(listUrl).not.toContain("to=");
  });

  test("transactions_summary returns range summary payload", async () => {
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.includes("/transactions/summary") && init?.method === "GET") {
        return jsonResponse(200, {
          data: {
            from: "2024-01-01",
            to: "2024-01-31",
            opening: 0,
            closing: 10000,
            amount_credit: 10000,
            amount_debit: 0,
            txn_count: 1,
          },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const session = await loginStore(handler);
    const summary = requireNamed(createTransactionTools(session), "transactions_summary");
    const result = await summary.handler({
      id: ACCOUNT_ID,
      from: "2024-01-01",
      to: "2024-01-31",
    });
    expect(result).toMatchObject({ closing: 10000, txn_count: 1 });
  });

  test("transactions_balance returns balance payload", async () => {
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.includes("/transactions/balance") && init?.method === "GET") {
        return jsonResponse(200, {
          data: { on: "2024-01-31", balance: 250000 },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const session = await loginStore(handler);
    const balance = requireNamed(createTransactionTools(session), "transactions_balance");
    const result = await balance.handler({ id: ACCOUNT_ID, on: "2024-01-31" });
    expect(result).toEqual({ on: "2024-01-31", balance: 250000 });
  });

  test("transactions_patch sends tagIds in camelCase body", async () => {
    let patchBody: unknown;
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.includes("/transactions/") && init?.method === "PATCH") {
        patchBody = init.body ? JSON.parse(String(init.body)) : null;
        return jsonResponse(200, {
          data: { id: TXN_ID, tags: [{ id: TAG_ID, name: "food" }] },
        });
      }
      throw new Error(`unexpected fetch ${url} ${init?.method}`);
    };

    const session = await loginStore(handler);
    const patch = requireNamed(createTransactionTools(session), "transactions_patch");
    await patch.handler({
      id: ACCOUNT_ID,
      transactionId: TXN_ID,
      ...txnWriteBody,
    });
    expect(patchBody).toMatchObject({ tagIds: [TAG_ID] });
  });

  test("transactions_bulk posts items to bulk endpoint", async () => {
    let bulkBody: unknown;
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: mePayload() });
      }
      if (
        url.includes("/transactions/bulk") &&
        init?.method === "POST" &&
        !url.includes("bulk-delete")
      ) {
        bulkBody = init.body ? JSON.parse(String(init.body)) : null;
        return jsonResponse(200, { data: { updated: 1 } });
      }
      throw new Error(`unexpected fetch ${url} ${init?.method}`);
    };

    const session = await loginStore(handler);
    const bulk = requireNamed(createTransactionTools(session), "transactions_bulk");
    await bulk.handler({
      id: ACCOUNT_ID,
      items: [{ id: TXN_ID, ...txnWriteBody }],
    });
    expect(bulkBody).toMatchObject({
      items: [{ id: TXN_ID, tagIds: [TAG_ID] }],
    });
  });

  test("transactions_bulk_delete posts ids to bulk-delete endpoint", async () => {
    let deleteBody: unknown;
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.includes("/transactions/bulk-delete") && init?.method === "POST") {
        deleteBody = init.body ? JSON.parse(String(init.body)) : null;
        return jsonResponse(200, { data: { deleted: 1 } });
      }
      throw new Error(`unexpected fetch ${url} ${init?.method}`);
    };

    const session = await loginStore(handler);
    const bulkDelete = requireNamed(createTransactionTools(session), "transactions_bulk_delete");
    await bulkDelete.handler({ id: ACCOUNT_ID, ids: [TXN_ID] });
    expect(deleteBody).toEqual({ ids: [TXN_ID] });
  });
});

describe("createCategoryTools", () => {
  test("categories_create posts camelCase body", async () => {
    let createBody: unknown;
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.endsWith(API.categories.create) && init?.method === "POST") {
        createBody = init.body ? JSON.parse(String(init.body)) : null;
        return jsonResponse(201, {
          data: { id: "cat-1", parentId: null, name: "Food", createdAt: "", updatedAt: "" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const session = await loginStore(handler);
    const create = requireNamed(createCategoryTools(session), "categories_create");
    await create.handler({ name: "Food", parentId: null });
    expect(createBody).toEqual({ name: "Food", parentId: null });
  });
});

describe("createTagTools", () => {
  test("tags_create posts name then used in transactions_patch", async () => {
    let tagCreateBody: unknown;
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.endsWith(API.tags.create) && init?.method === "POST") {
        tagCreateBody = init.body ? JSON.parse(String(init.body)) : null;
        return jsonResponse(201, {
          data: { id: TAG_ID, name: "food", created_at: "", updated_at: "" },
        });
      }
      throw new Error(`unexpected fetch ${url} ${init?.method}`);
    };

    const session = await loginStore(handler);
    const createTag = requireNamed(createTagTools(session), "tags_create");
    const tag = await createTag.handler({ name: "food" });
    expect(tagCreateBody).toEqual({ name: "food" });
    expect(tag).toMatchObject({ id: TAG_ID, name: "food" });
  });
});
