import { describe, expect, test } from "bun:test";
import { createApp } from "@ndb/api";
import { API } from "@ndb/platform";
import { readApiJson, type UserResponse } from "@tests/api/helpers/api-response";
import { createAuthTestServices, loginAs } from "@tests/api/helpers/auth-services";
import { fakeConfig } from "@tests/api/helpers/config";
import { createMemoryLogger } from "@tests/api/helpers/memory.logger";
import { enrollTotp, resetTotpStep, tokenFromEmail, totpCode } from "@tests/auth/helpers";
import { firstElement } from "@tests/core/helpers/assert";

describe("auth recovery email routes", () => {
  test("PATCH /users/me enrolls recovery email and GET /me reflects it", async () => {
    const services = await createAuthTestServices("dana", "password123");
    const token = await loginAs(services, "dana", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const enrollResponse = await app.request(API.users.me.update, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recovery_email: "dana@example.com",
        current_password: "password123",
      }),
    });
    expect(enrollResponse.status).toBe(200);

    const meResponse = await app.request(API.users.me.details, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meBody = await readApiJson<UserResponse>(meResponse);
    expect(meBody.data.recovery_email_enabled).toBe(true);
    expect(meBody.data.recovery_email_set_at).not.toBeNull();
  });

  test("password reset begin and complete flow", async () => {
    const services = await createAuthTestServices("erin", "password123");
    const token = await loginAs(services, "erin", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    await app.request(API.users.me.update, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recovery_email: "erin@example.com",
        current_password: "password123",
      }),
    });

    const secret = await enrollTotp(services, "erin", "password123");

    services.emailSender.clearMessages();
    const beginResponse = await app.request(API.auth.recovery.password.begin, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "erin", email: "erin@example.com" }),
    });
    expect(beginResponse.status).toBe(200);
    expect(services.emailSender.messages).toHaveLength(1);

    const resetToken = tokenFromEmail(firstElement(services.emailSender.messages, "email").body);
    await resetTotpStep(services, "erin");

    const completeResponse = await app.request(API.auth.recovery.password.complete, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: resetToken,
        new_password: "newpassword456",
        totp: totpCode(secret),
      }),
    });
    expect(completeResponse.status).toBe(200);

    const oldLogin = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "erin", password: "password123" }),
    });
    expect(oldLogin.status).toBe(401);
  });

  test("PATCH /users/me clears recovery email", async () => {
    const services = await createAuthTestServices("fiona", "password123");
    const token = await loginAs(services, "fiona", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    await app.request(API.users.me.update, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recovery_email: "fiona@example.com",
        current_password: "password123",
      }),
    });

    const deleteResponse = await app.request(API.users.me.update, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recovery_email: null, current_password: "password123" }),
    });
    expect(deleteResponse.status).toBe(200);

    const meResponse = await app.request(API.users.me.details, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meBody = await readApiJson<UserResponse>(meResponse);
    expect(meBody.data.recovery_email_enabled).toBe(false);
  });

  test("password reset complete rejects invalid token", async () => {
    const services = await createAuthTestServices("helen", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const response = await app.request(API.auth.recovery.password.complete, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "not-a-valid-token",
        new_password: "newpassword456",
      }),
    });

    expect(response.status).toBe(400);
  });
});
