import { describe, expect, test } from "bun:test";
import { SessionStore } from "@mcp/auth/session-store";
import { createAdminTools } from "@mcp/tools/admin";
import { API } from "@ndb/platform";
import { requireNamed } from "@tests/mcp/require-named";

const API_ORIGIN = "http://127.0.0.1:8000";

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

describe("createAdminTools", () => {
  test("users_admin_list throws for role user", async () => {
    let listCalled = false;
    const handler = (url: string) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, {
          data: {
            id: "user-1",
            username: "usher",
            role: "user",
            multifactorEnabled: false,
          },
        });
      }
      if (url.includes(API.users.list)) {
        listCalled = true;
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const store = new SessionStore({
      apiOrigin: API_ORIGIN,
      fetchImpl: async (url) => handler(url),
    });
    await store.login({ username: "usher", password: "admin" });
    const list = requireNamed(createAdminTools(store), "users_admin_list");
    await expect(list.handler({})).rejects.toThrow("mcp.admin.forbidden");
    expect(listCalled).toBe(false);
  });
});
