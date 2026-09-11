import { describe, expect, test } from "bun:test";
import { createApp } from "@ndb/api";
import { API } from "@ndb/platform";
import { createAuthTestServices } from "@tests/api/helpers/auth-services";
import { fakeConfig } from "@tests/api/helpers/config";
import { createMemoryLogger } from "@tests/api/helpers/memory.logger";
import { createTestSecurityStores } from "@tests/auth/helpers";

describe("auth rate limit routes", () => {
  test("returns 429 after exceeding the shared IP bucket", async () => {
    const services = await createAuthTestServices(
      "ratelimit",
      "password123",
      "user",
      false,
      false,
      createTestSecurityStores(2)
    );
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
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
      error: "middleware.auth.ratelimit.error.too-many-requests",
      code: "too_many_requests",
    });
  });

  test("recovery begin shares the same IP bucket", async () => {
    const services = await createAuthTestServices(
      "recoverylimit",
      "password123",
      "user",
      false,
      false,
      createTestSecurityStores(2)
    );
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
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
