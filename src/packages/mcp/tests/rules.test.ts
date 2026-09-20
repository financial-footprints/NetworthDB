import { describe, expect, test } from "bun:test";
import { McpAuthError } from "@mcp/auth/gate";
import { SessionStore } from "@mcp/auth/session-store";
import { createRuleTools } from "@mcp/tools/rules";
import { API } from "@ndb/platform";
import { requireNamed } from "@tests/mcp/require-named";

const API_ORIGIN = "http://127.0.0.1:8000";
const RULE_ID = "00000000-0000-4000-8000-000000000001";

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

const sampleTxn = {
  date: "2024-01-01",
  amount: 10000,
  sourceAccountId: "00000000-0000-4000-8000-000000000010",
  destinationAccountId: "00000000-0000-4000-8000-000000000011",
  description: "Test",
};

describe("createRuleTools", () => {
  test("rules_test without session throws McpAuthError", async () => {
    const session = new SessionStore({ apiOrigin: API_ORIGIN });
    const testTool = requireNamed(createRuleTools(session), "rules_test");
    await expect(testTool.handler({ id: RULE_ID, ...sampleTxn })).rejects.toBeInstanceOf(
      McpAuthError
    );
  });

  test("rules_test POSTs camelCase body after login", async () => {
    let testBody: unknown;
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.includes("/rules/") && url.endsWith("/test") && init?.method === "POST") {
        testBody = init.body ? JSON.parse(String(init.body)) : null;
        return jsonResponse(200, {
          data: { matched: true, actions: [], warnings: [] },
        });
      }
      throw new Error(`unexpected fetch ${url} ${init?.method}`);
    };

    const session = await loginStore(handler);
    const testTool = requireNamed(createRuleTools(session), "rules_test");
    const result = await testTool.handler({ id: RULE_ID, ...sampleTxn });
    expect(testBody).toMatchObject({ amount: 10000, sourceAccountId: sampleTxn.sourceAccountId });
    expect(result).toMatchObject({ matched: true });
  });

  test("rules_apply with dryRun returns job id", async () => {
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.includes("/rules/") && url.endsWith("/apply") && init?.method === "POST") {
        return jsonResponse(202, { data: { jobId: "job-1" } });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const session = await loginStore(handler);
    const apply = requireNamed(createRuleTools(session), "rules_apply");
    const result = await apply.handler({ id: RULE_ID, dryRun: true });
    expect(result).toEqual({ jobId: "job-1" });
  });
});
