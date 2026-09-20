import { describe, expect, test } from "bun:test";
import { API, apiPath } from "@ndb/platform";
import {
  readApiData,
  readApiJson,
  type SessionTokenPair,
  type UserResponse,
} from "@tests/api/helpers/api-response";
import { loginViaApp } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";

describe("auth admin routes", () => {
  test("POST /api/v1/users returns 201 for administrators", async () => {
    const { app } = await createTestApp({
      username: "admin",
      password: "password123",
      role: "administrator",
    });
    const token = await loginViaApp(app, "admin", "password123");

    const response = await app.request(API.users.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "bob", password: "password123" }),
    });

    expect(response.status).toBe(201);
    const body = await readApiData<UserResponse>(response);
    expect(body.username).toBe("bob");
    expect(body.role).toBe("user");
    expect(body.createdAt).toBeDefined();
  });

  test("POST /api/v1/users returns 403 for regular users", async () => {
    const { app } = await createTestApp({
      username: "alice",
      password: "password123",
      role: "user",
    });
    const token = await loginViaApp(app, "alice", "password123");

    const response = await app.request(API.users.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "bob", password: "password123" }),
    });

    expect(response.status).toBe(403);
  });

  test("GET /api/v1/users returns 200 for managers", async () => {
    const { app } = await createTestApp({
      username: "manager",
      password: "password123",
      role: "manager",
    });
    const token = await loginViaApp(app, "manager", "password123");

    const response = await app.request(API.users.list, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = await readApiJson<{ total: number }>(response);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  test("DELETE /api/v1/users/:id returns 400 for self-delete", async () => {
    const { app } = await createTestApp({
      username: "admin",
      password: "password123",
      role: "administrator",
    });
    const token = await loginViaApp(app, "admin", "password123");
    const me = await app.request(API.users.me.get, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meBody = await readApiData<UserResponse>(me);

    const response = await app.request(apiPath(API.users.delete, { userId: meBody.id }), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(400);
  });

  test("PATCH /api/v1/users/me rotates sessions when changing password", async () => {
    const { app } = await createTestApp({
      username: "alice",
      password: "password123",
      role: "user",
    });
    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody = await readApiData<SessionTokenPair>(loginResponse);
    const oldRefresh = loginBody.refreshToken;

    const response = await app.request(API.users.me.patch, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${loginBody.sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword: "password123",
        newPassword: "newpassword1",
      }),
    });

    expect(response.status).toBe(200);
    const refreshResponse = await app.request(API.auth.session.refresh, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: oldRefresh }),
    });
    expect(refreshResponse.status).toBe(401);
  });

  test("GET /api/v1/users returns 403 for regular users", async () => {
    const { app } = await createTestApp({
      username: "alice",
      password: "password123",
      role: "user",
    });
    const token = await loginViaApp(app, "alice", "password123");

    const response = await app.request(API.users.list, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(403);
  });

  test("POST /api/v1/users rejects missing username", async () => {
    const { app } = await createTestApp({
      username: "admin",
      password: "password123",
      role: "administrator",
    });
    const token = await loginViaApp(app, "admin", "password123");

    const response = await app.request(API.users.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "", password: "password123" }),
    });

    expect(response.status).toBe(400);
  });

  test("PATCH /api/v1/users/:id updates role", async () => {
    const { app } = await createTestApp({
      username: "admin",
      password: "password123",
      role: "administrator",
    });
    const adminToken = await loginViaApp(app, "admin", "password123");

    const registerResponse = await app.request(API.users.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "carol", password: "password123" }),
    });
    const registerBody = await readApiData<UserResponse>(registerResponse);

    const response = await app.request(apiPath(API.users.patch, { userId: registerBody.id }), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "manager" }),
    });

    expect(response.status).toBe(200);
    const body = await readApiData<UserResponse>(response);
    expect(body.role).toBe("manager");
  });
});
