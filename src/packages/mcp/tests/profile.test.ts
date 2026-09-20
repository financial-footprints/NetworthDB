import { describe, expect, test } from "bun:test";
import { SessionStore } from "@mcp/auth/session-store";
import { createProfileTools } from "@mcp/tools/profile";
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

type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;

async function loginStore(handler: FetchHandler) {
  const store = new SessionStore({
    apiOrigin: API_ORIGIN,
    fetchImpl: async (url, init) => handler(url, init),
  });
  await store.login({ username: "usher", password: "admin" });
  return store;
}

describe("createProfileTools", () => {
  test("profile_patch rejects plaintext display_name when E2EE is on", async () => {
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get) && init?.method === "GET") {
        return jsonResponse(200, {
          data: {
            id: "user-1",
            username: "usher",
            role: "user",
            multifactorEnabled: false,
            clientSettings: { e2ee: { display_name: true } },
          },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const session = await loginStore(handler);
    const patch = requireNamed(createProfileTools(session), "profile_patch");
    await expect(patch.handler({ displayName: "Alice" })).rejects.toThrow(
      "mcp.e2ee.display_name.unsupported"
    );
  });

  test("profile_patch allows blob display_name when E2EE is on", async () => {
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get) && init?.method === "GET") {
        return jsonResponse(200, {
          data: {
            id: "user-1",
            username: "usher",
            role: "user",
            multifactorEnabled: false,
            clientSettings: null,
          },
        });
      }
      if (url.endsWith(API.users.me.patch) && init?.method === "PATCH") {
        return jsonResponse(200, { data: null });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const session = await loginStore(handler);
    const patch = requireNamed(createProfileTools(session), "profile_patch");
    await patch.handler({ displayName: E2EE_BLOB });
  });
});
