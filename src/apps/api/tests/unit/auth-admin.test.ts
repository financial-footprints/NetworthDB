import { describe, expect, test } from "bun:test";
import { createApp } from "@ndb/api";
import { API } from "@ndb/platform";
import {
  type PublicUserResponse,
  readApiJson,
  type SessionTokenPair,
} from "@tests/api/helpers/api-response";
import { createAuthTestServices, loginViaApp } from "@tests/api/helpers/auth-services";
import { fakeConfig } from "@tests/api/helpers/config";
import { createMemoryLogger } from "@tests/api/helpers/memory.logger";

describe("auth admin routes", () => {
  test("POST /api/v1/users returns 201 for administrators", async () => {
    const services = await createAuthTestServices("admin", "password123", "administrator");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
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
    const body = await readApiJson<PublicUserResponse>(response);
    expect(body.data.username).toBe("bob");
    expect(body.data.role).toBe("user");
    expect(body.data.created_at).toBeDefined();
  });

  test("POST /api/v1/users returns 403 for regular users", async () => {
    const services = await createAuthTestServices("alice", "password123", "user");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
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
    const services = await createAuthTestServices("manager", "password123", "manager");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "manager", "password123");

    const response = await app.request(API.users.list, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = await readApiJson<{ total: number }>(response);
    expect(body.data.total).toBeGreaterThanOrEqual(1);
  });

  test("DELETE /api/v1/users/:id returns 400 for self-delete", async () => {
    const services = await createAuthTestServices("admin", "password123", "administrator");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "admin", "password123");
    const me = await app.request(API.users.me.details, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meBody = await readApiJson<PublicUserResponse>(me);

    const response = await app.request(API.users.details.replace(":id", meBody.data.id), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(400);
  });

  test("PATCH /api/v1/users/me rotates sessions when changing password", async () => {
    const services = await createAuthTestServices("alice", "password123", "user");
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
    const oldRefresh = loginBody.data.refresh_token;

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
    const refreshResponse = await app.request(API.auth.session.refresh, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: oldRefresh }),
    });
    expect(refreshResponse.status).toBe(401);
  });

  test("GET /api/v1/users returns 403 for regular users", async () => {
    const services = await createAuthTestServices("alice", "password123", "user");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "alice", "password123");

    const response = await app.request(API.users.list, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(403);
  });

  test("POST /api/v1/users rejects missing username", async () => {
    const services = await createAuthTestServices("admin", "password123", "administrator");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
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
    const services = await createAuthTestServices("admin", "password123", "administrator");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
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
    const registerBody = await readApiJson<PublicUserResponse>(registerResponse);

    const response = await app.request(API.users.details.replace(":id", registerBody.data.id), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "manager" }),
    });

    expect(response.status).toBe(200);
    const body = await readApiJson<PublicUserResponse>(response);
    expect(body.data.role).toBe("manager");
  });
});
