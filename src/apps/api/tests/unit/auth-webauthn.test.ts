import { describe, expect, test } from "bun:test";
import { createApp } from "@ndb/api";
import { API } from "@ndb/platform";
import { readApiJson } from "@tests/api/helpers/api-response";
import { createAuthTestServices, loginViaApp } from "@tests/api/helpers/auth-services";
import { fakeConfig } from "@tests/api/helpers/config";
import { createMemoryLogger } from "@tests/api/helpers/memory.logger";

describe("auth webauthn routes", () => {
  test("GET /api/v1/auth/multifactor/webauthn/credentials returns an empty list", async () => {
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "alice", "password123");

    const response = await app.request(API.users.me.webauthn.list, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = await readApiJson<{ total: number; items: unknown[] }>(response);
    expect(body.data.total).toBe(0);
    expect(body.data.items).toEqual([]);
  });

  test("POST /api/v1/auth/multifactor/webauthn/register/begin requires authentication", async () => {
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const response = await app.request(API.users.me.webauthn.create.begin, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "password123" }),
    });

    expect(response.status).toBe(401);
  });

  test("POST /api/v1/auth/multifactor/webauthn/register/begin rejects when WebAuthn is not configured", async () => {
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
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
    expect(String(body.error)).toContain("core.auth.webauthn.invalid.not-configured");
  });

  test("POST /api/v1/auth/multifactor/webauthn/login/begin requires authentication", async () => {
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const response = await app.request(API.auth.session.multifactor.webauthn.begin, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(401);
  });

  test("POST /api/v1/auth/multifactor/webauthn/register/begin requires password when multifactor is off", async () => {
    const services = await createAuthTestServices("wuser", "password123", "user", false, true);
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
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
