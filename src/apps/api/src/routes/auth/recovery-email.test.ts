import { describe, expect, test } from "bun:test";
import { firstElement } from "@ndb/core/tests";
import { API } from "@ndb/platform";
import { readApiData, type UserResponse } from "@tests/api/helpers/api-response";
import type { AuthTestServices } from "@tests/api/helpers/auth-services";
import { loginViaApp } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";
import { enrollTotp, resetTotpStep, tokenFromEmail, totpCode } from "@tests/auth/helpers";

function totpServices(services: AuthTestServices) {
  return { users: services.users, auth: services.authService };
}

describe("auth recovery email routes", () => {
  test("PATCH /users/me enrolls recovery email and GET /me reflects it", async () => {
    const { app } = await createTestApp({ username: "dana", password: "password123" });
    const token = await loginViaApp(app, "dana", "password123");

    const enrollResponse = await app.request(API.users.me.patch, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recoveryEmail: "dana@example.com",
        currentPassword: "password123",
      }),
    });
    expect(enrollResponse.status).toBe(200);

    const meResponse = await app.request(API.users.me.get, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meBody = await readApiData<UserResponse>(meResponse);
    expect(meBody.recoveryEmailEnabled).toBe(true);
    expect(meBody.recoveryEmailSetAt).not.toBeNull();
  });

  test("password reset begin and complete flow", async () => {
    const { app, services } = await createTestApp({ username: "erin", password: "password123" });
    const token = await loginViaApp(app, "erin", "password123");

    await app.request(API.users.me.patch, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recoveryEmail: "erin@example.com",
        currentPassword: "password123",
      }),
    });

    const secret = await enrollTotp(totpServices(services), "erin", "password123");

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
        newPassword: "newpassword456",
        totp: totpCode(secret),
      }),
    });
    expect(completeResponse.status).toBe(204);

    const oldLogin = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "erin", password: "password123" }),
    });
    expect(oldLogin.status).toBe(401);
  });

  test("PATCH /users/me clears recovery email", async () => {
    const { app } = await createTestApp({ username: "fiona", password: "password123" });
    const token = await loginViaApp(app, "fiona", "password123");

    await app.request(API.users.me.patch, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recoveryEmail: "fiona@example.com",
        currentPassword: "password123",
      }),
    });

    const deleteResponse = await app.request(API.users.me.patch, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recoveryEmail: null, currentPassword: "password123" }),
    });
    expect(deleteResponse.status).toBe(200);

    const meResponse = await app.request(API.users.me.get, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meBody = await readApiData<UserResponse>(meResponse);
    expect(meBody.recoveryEmailEnabled).toBe(false);
  });

  test("password reset complete rejects invalid token", async () => {
    const { app } = await createTestApp({ username: "helen", password: "password123" });

    const response = await app.request(API.auth.recovery.password.complete, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "not-a-valid-token",
        newPassword: "newpassword456",
      }),
    });

    expect(response.status).toBe(400);
  });
});
