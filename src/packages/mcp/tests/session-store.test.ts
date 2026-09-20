import { describe, expect, test } from "bun:test";
import { McpApiError } from "@mcp/api/errors";
import { McpAuthError, requireSession } from "@mcp/auth/gate";
import { SessionStore } from "@mcp/auth/session-store";
import { API } from "@ndb/platform";

const API_ORIGIN = "http://127.0.0.1:8000";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function tokenPair(expiresIn = 3600) {
  return {
    sessionToken: "session-abc",
    refreshToken: "refresh-xyz",
    expiresIn: expiresIn,
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

function createStore(handler: FetchHandler) {
  const fetchImpl = async (url: string, init?: RequestInit) => handler(url, init);
  const store = new SessionStore({ apiOrigin: API_ORIGIN, fetchImpl });
  return { store };
}

describe("SessionStore", () => {
  test("login with session tokens authenticates and caches access token", async () => {
    let refreshCalls = 0;
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login) && init?.method === "POST") {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get) && init?.method === "GET") {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.endsWith(API.auth.session.refresh)) {
        refreshCalls += 1;
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const { store } = createStore(handler);
    const outcome = await store.login({ username: "Usher", password: "admin" });
    expect(outcome.kind).toBe("authenticated");
    expect(store.isAuthenticated()).toBe(true);

    const token = await store.getAccessToken();
    expect(token).toBe("session-abc");
    expect(refreshCalls).toBe(0);
    expect(store.getState().user?.username).toBe("usher");
  });

  test("MFA challenge then totp completes login", async () => {
    let mfaBody: unknown;
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, {
          data: {
            status: "multifactor_required",
            multifactorToken: "mfa-token",
            expiresIn: 300,
            methods: ["totp"],
          },
        });
      }
      if (url.endsWith(API.auth.session.multifactor.otp)) {
        mfaBody = init?.body ? JSON.parse(String(init.body)) : null;
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: { ...mePayload(), multifactorEnabled: true } });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const { store } = createStore(handler);
    const challenge = await store.login({ username: "usher", password: "admin" });
    expect(challenge.kind).toBe("mfa_required");
    expect(store.isAuthenticated()).toBe(false);

    const done = await store.login({
      multifactorToken: "mfa-token",
      totp: "123456",
    });
    expect(done.kind).toBe("authenticated");
    expect(mfaBody).toEqual({ totp: "123456" });
    expect(store.getState().user?.aal).toBe("aal2");
  });

  test("login 401 maps to McpApiError", async () => {
    const handler: FetchHandler = (url) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(401, { error: "invalid credentials", code: "auth.invalid" });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const { store } = createStore(handler);
    await expect(store.login({ username: "bad", password: "bad" })).rejects.toBeInstanceOf(
      McpApiError
    );
  });

  test("stale access token refreshes and deduplicates concurrent getAccessToken", async () => {
    let refreshCalls = 0;
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair(120) });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.endsWith(API.auth.session.refresh) && init?.method === "POST") {
        refreshCalls += 1;
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(
              jsonResponse(200, {
                data: {
                  sessionToken: "session-refreshed",
                  refreshToken: "refresh-xyz",
                  expiresIn: 3600,
                },
              })
            );
          }, 20);
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const { store } = createStore(handler);
    const loginAt = Date.now();
    await store.login({ username: "usher", password: "admin" });

    const staleNow = loginAt + 61_000;
    const [a, b] = await Promise.all([
      store.getAccessToken(staleNow),
      store.getAccessToken(staleNow),
    ]);
    expect(a).toBe("session-refreshed");
    expect(b).toBe("session-refreshed");
    expect(refreshCalls).toBe(1);
  });

  test("authenticateWithAccessToken hydrates session without refresh token", async () => {
    let refreshCalls = 0;
    const handler: FetchHandler = (url, init) => {
      if (url.endsWith(API.users.me.get) && init?.method === "GET") {
        const auth =
          init.headers instanceof Headers
            ? init.headers.get("Authorization")
            : (init.headers as Record<string, string> | undefined)?.Authorization;
        expect(auth).toBe("Bearer http-bearer-token");
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.endsWith(API.auth.session.refresh)) {
        refreshCalls += 1;
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const { store } = createStore(handler);
    await store.authenticateWithAccessToken("http-bearer-token");
    expect(store.isAuthenticated()).toBe(true);
    expect(await store.getAccessToken()).toBe("http-bearer-token");
    expect(refreshCalls).toBe(0);
  });

  test("authenticateWithAccessToken rejects invalid me response", async () => {
    const handler: FetchHandler = (url) => {
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(401, { error: "unauthorized" });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const { store } = createStore(handler);
    await expect(store.authenticateWithAccessToken("bad-token")).rejects.toBeInstanceOf(
      McpApiError
    );
    expect(store.isAuthenticated()).toBe(false);
  });

  test("bearer-only session does not refresh when access cache is stale", async () => {
    let refreshCalls = 0;
    const handler: FetchHandler = (url) => {
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.endsWith(API.auth.session.refresh)) {
        refreshCalls += 1;
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const { store } = createStore(handler);
    const loginAt = Date.now();
    await store.authenticateWithAccessToken("bearer-only");
    const staleNow = loginAt + 3_700_000;
    await expect(store.getAccessToken(staleNow)).rejects.toBeInstanceOf(McpAuthError);
    expect(refreshCalls).toBe(0);
  });
});

describe("requireSession", () => {
  test("throws when empty and returns user id when set", async () => {
    const handler: FetchHandler = (url) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: mePayload() });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const store = new SessionStore({
      apiOrigin: API_ORIGIN,
      fetchImpl: (url, init) => Promise.resolve(handler(url, init)),
    });
    expect(() => requireSession(store)).toThrow(McpAuthError);

    await store.login({ username: "usher", password: "admin" });
    const user = requireSession(store);
    expect(user.id).toBe("user-1");
  });
});
