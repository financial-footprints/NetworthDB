import { describe, expect, test } from "bun:test";
import { API } from "@ndb/platform";
import { readApiJson } from "@tests/api/helpers/api-response";
import { loginViaApp } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";

describe("auth webauthn routes", () => {
  test("GET /api/v1/users/me/webauthn/credentials returns an empty list", async () => {
    const { app } = await createTestApp();
    const token = await loginViaApp(app, "alice", "password123");

    const response = await app.request(API.users.me.webauthn.list, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = await readApiJson<{ total: number; items: unknown[] }>(response);
    expect(body.total).toBe(0);
    expect(body.items).toEqual([]);
  });

  test("POST /api/v1/users/me/webauthn/register/begin requires authentication", async () => {
    const { app } = await createTestApp();

    const response = await app.request(API.users.me.webauthn.create.begin, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "password123" }),
    });

    expect(response.status).toBe(401);
  });

  test("POST /api/v1/users/me/webauthn/register/begin rejects when WebAuthn is not configured", async () => {
    const { app } = await createTestApp();
    const token = await loginViaApp(app, "alice", "password123");

    const response = await app.request(API.users.me.webauthn.create.begin, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: "password123" }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(String(body.error)).toContain("Passkeys are not configured");
  });

  test("POST /api/v1/auth/multifactor/webauthn/login/begin requires authentication", async () => {
    const { app } = await createTestApp();

    const response = await app.request(API.auth.session.multifactor.webauthn.begin, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(401);
  });

  test("POST /api/v1/users/me/webauthn/register/begin requires password when multifactor is off", async () => {
    const { app } = await createTestApp({
      username: "wuser",
      password: "password123",
      role: "user",
      multifactorEnabled: false,
      webauthnEnabled: true,
    });
    const token = await loginViaApp(app, "wuser", "password123");

    const response = await app.request(API.users.me.webauthn.create.begin, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });
});
