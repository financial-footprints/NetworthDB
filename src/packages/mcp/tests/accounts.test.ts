import { describe, expect, test } from "bun:test";
import { McpAuthError } from "@mcp/auth/gate";
import { SessionStore } from "@mcp/auth/session-store";
import { createAccountTools } from "@mcp/tools/accounts";
import { createStatementTools } from "@mcp/tools/statements";
import { API } from "@ndb/platform";
import { requireNamed } from "@tests/mcp/require-named";

const API_ORIGIN = "http://127.0.0.1:8000";
const E2EE_BLOB = `${"a".repeat(16)}.${"b".repeat(16)}`;

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

function mePayload(clientSettings?: Record<string, unknown>) {
  return {
    id: "user-1",
    username: "usher",
    role: "user",
    multifactorEnabled: false,
    clientSettings: clientSettings ?? null,
  };
}

type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function createStore(handler: FetchHandler) {
  const fetchImpl = async (url: string, init?: RequestInit) => handler(url, init);
  return new SessionStore({ apiOrigin: API_ORIGIN, fetchImpl });
}

async function loginStore(handler: FetchHandler) {
  const store = createStore(handler);
  await store.login({ username: "usher", password: "admin" });
  return store;
}

describe("createAccountTools", () => {
  test("accounts_list without session throws McpAuthError", async () => {
    const session = createStore(() => jsonResponse(500, {}));
    const list = requireNamed(createAccountTools(session), "accounts_list");
    await expect(list.handler({})).rejects.toBeInstanceOf(McpAuthError);
  });

  test("accounts_list calls GET /api/v1/accounts after login", async () => {
    let listUrl = "";
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get) && init?.method === "GET") {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.includes(API.accounts.list) && init?.method === "GET") {
        listUrl = url;
        return jsonResponse(200, { data: { items: [], total: 0 } });
      }
      throw new Error(`unexpected fetch ${url} ${init?.method}`);
    };

    const session = await loginStore(handler);
    const list = requireNamed(createAccountTools(session), "accounts_list");
    await list.handler({});
    expect(listUrl).toContain(`${API_ORIGIN}${API.accounts.list}`);
  });

  test("accounts_create rejects plaintext accountNumber when E2EE is on", async () => {
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get) && init?.method === "GET") {
        return jsonResponse(200, {
          data: mePayload({ e2ee: { account_number: true } }),
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const session = await loginStore(handler);
    const create = requireNamed(createAccountTools(session), "accounts_create");
    await expect(
      create.handler({
        bank: "HDFC",
        accountType: "bank",
        openingDate: "2024-01-01",
        accountNumber: "1234567890",
      })
    ).rejects.toThrow("mcp.e2ee.account_number.unsupported");
  });

  test("accounts_create allows blob-shaped accountNumber when E2EE is on", async () => {
    let createBody: unknown;
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get) && init?.method === "GET") {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.endsWith(API.accounts.create) && init?.method === "POST") {
        createBody = init.body ? JSON.parse(String(init.body)) : null;
        return jsonResponse(201, {
          data: { id: "acc-1", accountNumber: E2EE_BLOB },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const session = await loginStore(handler);
    const create = requireNamed(createAccountTools(session), "accounts_create");
    const result = await create.handler({
      bank: "HDFC",
      accountType: "bank",
      openingDate: "2024-01-01",
      accountNumber: E2EE_BLOB,
    });
    expect(createBody).toMatchObject({ accountNumber: E2EE_BLOB });
    expect(result).toEqual({ id: "acc-1", accountNumber: E2EE_BLOB });
  });
});

describe("createStatementTools", () => {
  test("statements_sync returns job id envelope", async () => {
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.endsWith(API.accounts.statements.sync) && init?.method === "POST") {
        return jsonResponse(202, { data: { jobId: "job-1" } });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const session = await loginStore(handler);
    const sync = requireNamed(createStatementTools(session), "statements_sync");
    const result = await sync.handler({
      accountId: "00000000-0000-4000-8000-000000000001",
    });
    expect(result).toEqual({ jobId: "job-1" });
  });
});
