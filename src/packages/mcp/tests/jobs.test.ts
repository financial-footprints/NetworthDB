import { describe, expect, test } from "bun:test";
import { SessionStore } from "@mcp/auth/session-store";
import { createJobTools } from "@mcp/tools/jobs";
import { API } from "@ndb/platform";
import { requireNamed } from "@tests/mcp/require-named";

const API_ORIGIN = "http://127.0.0.1:8000";
const JOB_ID = "00000000-0000-4000-8000-000000000099";

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

async function loginStore(handler: (url: string, init?: RequestInit) => Response) {
  const store = new SessionStore({
    apiOrigin: API_ORIGIN,
    fetchImpl: async (url, init) => handler(url, init),
  });
  await store.login({ username: "usher", password: "admin" });
  return store;
}

describe("createJobTools", () => {
  test("jobs_wait returns when job is already completed", async () => {
    const handler = (url: string, init?: RequestInit) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.includes(`/jobs/${JOB_ID}`) && init?.method === "GET") {
        return jsonResponse(200, {
          data: {
            id: JOB_ID,
            status: "completed",
            stage: "rules_apply",
            account_id: null,
            financial_year: null,
            rule_id: null,
            group_id: null,
            created_at: "",
            completed_at: "",
            output: {},
            error: null,
          },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const session = await loginStore(handler);
    const wait = requireNamed(createJobTools(session), "jobs_wait");
    const result = await wait.handler({ id: JOB_ID });
    expect(result).toMatchObject({ id: JOB_ID, status: "completed" });
  });
});
