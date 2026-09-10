import { describe, expect, test } from "bun:test";
import { createApp } from "@ndb/api";
import { API } from "@ndb/platform";
import {
  type PublicUserResponse,
  readApiJson,
  type SessionTokenPair,
} from "@tests/api/helpers/api-response";
import { createAuthTestServices } from "@tests/api/helpers/auth-services";
import { fakeConfig } from "@tests/api/helpers/config";
import { createMemoryLogger } from "@tests/api/helpers/memory.logger";

describe("auth routes", () => {
  test("POST /api/v1/auth/login returns a session pair", async () => {
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const response = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });

    expect(response.status).toBe(200);
    const body = await readApiJson<SessionTokenPair>(response);
    expect(body.errors).toEqual([]);
    expect(body.data.token_type).toBe("Bearer");
    expect(body.data.session_token).toMatch(/^[0-9a-f]{64}$/);
    expect(body.data.refresh_token).toMatch(/^[0-9a-f]{64}$/);
    expect(body.data.expires_in).toBe(15 * 60);
  });

  test("POST /api/v1/auth/login rejects invalid credentials", async () => {
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const response = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "wrong-password" }),
    });

    expect(response.status).toBe(401);
  });

  test("GET /api/v1/users/me requires a bearer token", async () => {
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const response = await app.request(API.users.me.details);
    expect(response.status).toBe(401);
  });

  test("leaf session middleware accepts login bearer on GET /users/me", async () => {
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    expect(loginResponse.status).toBe(200);
    const loginBody = await readApiJson<SessionTokenPair>(loginResponse);

    const meResponse = await app.request(API.users.me.details, {
      headers: { Authorization: `Bearer ${loginBody.data.session_token}` },
    });
    expect(meResponse.status).toBe(200);
  });

  test("session token resolves via service and HTTP middleware", async () => {
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    expect(loginResponse.status).toBe(200);
    const loginBody = await readApiJson<SessionTokenPair>(loginResponse);

    const resolved = await services.auth.get(loginBody.data.session_token);
    expect(resolved.user.username).toBe("alice");

    const meResponse = await app.request(API.users.me.details, {
      headers: { Authorization: `Bearer ${loginBody.data.session_token}` },
    });
    expect(meResponse.status).toBe(200);
  });

  test("GET /api/v1/users/me returns the current user", async () => {
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody = await readApiJson<SessionTokenPair>(loginResponse);

    const response = await app.request(API.users.me.details, {
      headers: {
        Authorization: `Bearer ${loginBody.data.session_token}`,
      },
    });

    expect(response.status).toBe(200);
    const body = await readApiJson<PublicUserResponse>(response);
    expect(body).toEqual({
      data: {
        id: expect.any(String),
        username: "alice",
        role: "user",
        multifactor_enabled: false,
        multifactor_methods: [],
        recovery_codes_enabled: false,
        recovery_email_enabled: false,
        recovery_email_set_at: null,
        e2ee_vault_initialized: false,
        e2ee_slots: [],
        e2ee_name: null,
      },
      errors: [],
    });
  });

  test("PATCH /api/v1/users/me is handled by account route, not admin :id route", async () => {
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody = await readApiJson<SessionTokenPair>(loginResponse);

    const response = await app.request(API.users.me.update, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${loginBody.data.session_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        current_password: "password123",
        new_password: "newpassword1",
      }),
    });

    expect(response.status).toBe(200);
  });

  test("GET /api/v1/users/me rejects an invalid bearer token", async () => {
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const response = await app.request(API.users.me.details, {
      headers: {
        Authorization: "Bearer not-a-real-token",
      },
    });

    expect(response.status).toBe(401);
  });

  test("POST /api/v1/auth/login rejects missing password", async () => {
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const response = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "" }),
    });

    expect(response.status).toBe(400);
  });

  test("POST /api/v1/auth/refresh rotates the session pair", async () => {
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody = await readApiJson<SessionTokenPair>(loginResponse);

    const refreshResponse = await app.request(API.auth.session.refresh, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: loginBody.data.refresh_token }),
    });

    expect(refreshResponse.status).toBe(200);
    const refreshBody = await readApiJson<SessionTokenPair>(refreshResponse);
    expect(refreshBody.data.session_token).toMatch(/^[0-9a-f]{64}$/);
    expect(refreshBody.data.refresh_token).not.toBe(loginBody.data.refresh_token);
  });

  test("POST /api/v1/auth/refresh rejects missing refresh_token", async () => {
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const response = await app.request(API.auth.session.refresh, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  test("POST /api/v1/auth/logout revokes the session", async () => {
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody = await readApiJson<SessionTokenPair>(loginResponse);

    const logoutResponse = await app.request(API.auth.session.logout, {
      method: "POST",
      headers: { Authorization: `Bearer ${loginBody.data.session_token}` },
    });
    expect(logoutResponse.status).toBe(200);

    const meResponse = await app.request(API.users.me.details, {
      headers: { Authorization: `Bearer ${loginBody.data.session_token}` },
    });
    expect(meResponse.status).toBe(401);
  });
});
