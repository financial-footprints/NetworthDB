import { describe, expect, test } from "bun:test";
import { API } from "@ndb/platform";
import {
  readApiJson,
  type SessionTokenPair,
  type UserResponse,
} from "@tests/api/helpers/api-response";
import { createTestApp } from "@tests/api/helpers/create-test-app";

describe("auth routes", () => {
  test("POST /api/v1/auth/login returns a session pair", async () => {
    const { app } = await createTestApp();

    const response = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });

    expect(response.status).toBe(200);
    const body = await readApiJson<{ data: SessionTokenPair }>(response);
    expect(body.data.sessionToken).toMatch(/^[0-9a-f]{64}$/);
    expect(body.data.refreshToken).toMatch(/^[0-9a-f]{64}$/);
    expect(body.data.expiresIn).toBe(15 * 60);
  });

  test("POST /api/v1/auth/login rejects invalid credentials", async () => {
    const { app } = await createTestApp();

    const response = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "wrong-password" }),
    });

    expect(response.status).toBe(401);
  });

  test("GET /api/v1/users/me requires a bearer token", async () => {
    const { app } = await createTestApp();

    const response = await app.request(API.users.me.get);
    expect(response.status).toBe(401);
  });

  test("leaf session middleware accepts login bearer on GET /users/me", async () => {
    const { app } = await createTestApp();

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    expect(loginResponse.status).toBe(200);
    const loginBody = await readApiJson<{ data: SessionTokenPair }>(loginResponse);

    const meResponse = await app.request(API.users.me.get, {
      headers: { Authorization: `Bearer ${loginBody.data.sessionToken}` },
    });
    expect(meResponse.status).toBe(200);
  });

  test("session token resolves via service and HTTP middleware", async () => {
    const { app, services } = await createTestApp();

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    expect(loginResponse.status).toBe(200);
    const loginBody = await readApiJson<{ data: SessionTokenPair }>(loginResponse);

    const resolved = await services.authService.get(loginBody.data.sessionToken);
    expect(resolved.user.username.toString()).toBe("alice");

    const meResponse = await app.request(API.users.me.get, {
      headers: { Authorization: `Bearer ${loginBody.data.sessionToken}` },
    });
    expect(meResponse.status).toBe(200);
  });

  test("GET /api/v1/users/me returns the current user", async () => {
    const { app } = await createTestApp();

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody = await readApiJson<{ data: SessionTokenPair }>(loginResponse);

    const response = await app.request(API.users.me.get, {
      headers: {
        Authorization: `Bearer ${loginBody.data.sessionToken}`,
      },
    });

    expect(response.status).toBe(200);
    const body = await readApiJson<{ data: UserResponse }>(response);
    expect(body).toEqual({
      data: {
        id: expect.any(String),
        username: "alice",
        role: "user",
        multifactorEnabled: false,
        multifactorMethods: [],
        recoveryCodesEnabled: false,
        recoveryEmailEnabled: false,
        recoveryEmailSetAt: null,
        vaultInitialized: false,
        vaultSlots: [],
        displayName: null,
        clientSettings: null,
      },
    });
  });

  test("PATCH /api/v1/users/me is handled by account route, not admin :id route", async () => {
    const { app } = await createTestApp();

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody = await readApiJson<{ data: SessionTokenPair }>(loginResponse);

    const response = await app.request(API.users.me.patch, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${loginBody.data.sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword: "password123",
        newPassword: "newpassword1",
      }),
    });

    expect(response.status).toBe(200);
  });

  test("GET /api/v1/users/me rejects an invalid bearer token", async () => {
    const { app } = await createTestApp();

    const response = await app.request(API.users.me.get, {
      headers: {
        Authorization: "Bearer not-a-real-token",
      },
    });

    expect(response.status).toBe(401);
  });

  test("POST /api/v1/auth/login rejects missing password", async () => {
    const { app } = await createTestApp();

    const response = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "" }),
    });

    expect(response.status).toBe(400);
  });

  test("POST /api/v1/auth/refresh rotates the session pair", async () => {
    const { app } = await createTestApp();

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody = await readApiJson<{ data: SessionTokenPair }>(loginResponse);

    const refreshResponse = await app.request(API.auth.session.refresh, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: loginBody.data.refreshToken }),
    });

    expect(refreshResponse.status).toBe(200);
    const refreshBody = await readApiJson<{ data: SessionTokenPair }>(refreshResponse);
    expect(refreshBody.data.sessionToken).toMatch(/^[0-9a-f]{64}$/);
    expect(refreshBody.data.refreshToken).not.toBe(loginBody.data.refreshToken);
  });

  test("POST /api/v1/auth/refresh rejects missing refresh_token", async () => {
    const { app } = await createTestApp();

    const response = await app.request(API.auth.session.refresh, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  test("POST /api/v1/auth/logout revokes the session", async () => {
    const { app } = await createTestApp();

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody = await readApiJson<{ data: SessionTokenPair }>(loginResponse);

    const logoutResponse = await app.request(API.auth.session.logout, {
      method: "POST",
      headers: { Authorization: `Bearer ${loginBody.data.sessionToken}` },
    });
    expect(logoutResponse.status).toBe(204);

    const meResponse = await app.request(API.users.me.get, {
      headers: { Authorization: `Bearer ${loginBody.data.sessionToken}` },
    });
    expect(meResponse.status).toBe(401);
  });
});
