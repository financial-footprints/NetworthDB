import { describe, expect, test } from "bun:test";
import { API } from "@ndb/platform";
import { createTestApp } from "@tests/api/helpers/create-test-app";
import { createTestSecurityStores } from "@tests/auth/helpers";

describe("auth rate limit routes", () => {
  test("returns 429 after exceeding the shared IP bucket", async () => {
    const { app } = await createTestApp({
      username: "ratelimit",
      password: "password123",
      role: "user",
      multifactorEnabled: false,
      webauthnEnabled: false,
      securityStores: createTestSecurityStores(2),
    });

    const body = JSON.stringify({ username: "ratelimit", password: "password123" });
    const headers = { "Content-Type": "application/json" };

    expect(
      (await app.request(API.auth.session.login, { method: "POST", headers, body })).status
    ).toBe(200);
    expect(
      (await app.request(API.auth.session.login, { method: "POST", headers, body })).status
    ).toBe(200);

    const limited = await app.request(API.auth.session.login, { method: "POST", headers, body });
    expect(limited.status).toBe(429);
    const errorBody = (await limited.json()) as { error: string; code: string };
    expect(errorBody).toMatchObject({
      error: "Too many requests.",
      code: "TOO_MANY_REQUESTS",
    });
  });

  test("recovery begin shares the same IP bucket", async () => {
    const { app } = await createTestApp({
      username: "recoverylimit",
      password: "password123",
      role: "user",
      multifactorEnabled: false,
      webauthnEnabled: false,
      securityStores: createTestSecurityStores(2),
    });

    const loginBody = JSON.stringify({ username: "recoverylimit", password: "password123" });
    const headers = { "Content-Type": "application/json" };

    expect(
      (await app.request(API.auth.session.login, { method: "POST", headers, body: loginBody }))
        .status
    ).toBe(200);
    expect(
      (await app.request(API.auth.session.login, { method: "POST", headers, body: loginBody }))
        .status
    ).toBe(200);

    const recoveryBody = JSON.stringify({
      username: "recoverylimit",
      email: "recoverylimit@example.com",
    });
    const limited = await app.request(API.auth.recovery.password.begin, {
      method: "POST",
      headers,
      body: recoveryBody,
    });
    expect(limited.status).toBe(429);
  });
});
