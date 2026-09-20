import { describe, expect, test } from "bun:test";
import { VAULT_SLOT_TYPE_PASSWORD, VAULT_SLOT_TYPE_RECOVERY_PHRASE } from "@ndb/core";
import { firstElement } from "@ndb/core/tests";
import { API } from "@ndb/platform";
import {
  type AdvancedRecoveryContextResponse,
  readApiData,
  type SessionTokenPair,
  type UserResponse,
} from "@tests/api/helpers/api-response";
import { loginViaApp } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";
import { tokenFromEmail } from "@tests/auth/helpers";

const DUMMY_SALT = "AQIDBAUGBwgJCgsMDQ4PEA";
const DUMMY_WRAP = "abc.def";
const PHRASE_SALT = "BQIDBAUGBwgJCgsMDQ4PEB";
const PHRASE_WRAP = "ghi.jkl";
const NEW_WRAP_SALT = "CQIDBAUGBwgJCgsMDQ4PEC";
const NEW_WRAP = "mno.pqr";

describe("auth advanced recovery routes", () => {
  test("begin → context → complete clears MFA and updates password wrap", async () => {
    const { app, services } = await createTestApp({ username: "frank", password: "password123" });
    const token = await loginViaApp(app, "frank", "password123");

    await app.request(API.users.me.patch, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recoveryEmail: "frank@example.com",
        currentPassword: "password123",
      }),
    });

    const initResponse = await app.request(API.users.me.vault.initialize, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slots: [
          {
            slotType: VAULT_SLOT_TYPE_PASSWORD,
            salt: DUMMY_SALT,
            wrapBlob: DUMMY_WRAP,
            password: "password123",
          },
          {
            slotType: VAULT_SLOT_TYPE_RECOVERY_PHRASE,
            salt: PHRASE_SALT,
            wrapBlob: PHRASE_WRAP,
            label: "backup phrase",
          },
        ],
      }),
    });
    expect(initResponse.status).toBe(201);

    services.emailSender.clearMessages();
    const beginResponse = await app.request(API.auth.recovery.advanced.begin, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "frank", email: "frank@example.com" }),
    });
    expect(beginResponse.status).toBe(200);
    expect(services.emailSender.messages).toHaveLength(1);

    const recoveryToken = tokenFromEmail(firstElement(services.emailSender.messages, "email").body);
    const contextResponse = await app.request(API.auth.recovery.advanced.context, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: recoveryToken }),
    });
    expect(contextResponse.status).toBe(200);
    const contextBody = await readApiData<AdvancedRecoveryContextResponse>(contextResponse);
    expect(contextBody.vaultInitialized).toBe(true);
    expect(contextBody.vaultRecoveryMethods).toEqual([VAULT_SLOT_TYPE_RECOVERY_PHRASE]);

    const completeResponse = await app.request(API.auth.recovery.advanced.complete, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: recoveryToken,
        newPassword: "resetpass789",
        passwordSlot: {
          salt: NEW_WRAP_SALT,
          wrapBlob: NEW_WRAP,
        },
      }),
    });
    expect(completeResponse.status).toBe(204);

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "frank", password: "resetpass789" }),
    });
    expect(loginResponse.status).toBe(200);

    const loginBody = await readApiData<SessionTokenPair>(loginResponse);
    const meResponse = await app.request(API.users.me.get, {
      headers: { Authorization: `Bearer ${loginBody.sessionToken}` },
    });
    const meBody = await readApiData<UserResponse>(meResponse);
    const passwordSlot = meBody.vaultSlots.find(
      (slot) => slot.slotType === VAULT_SLOT_TYPE_PASSWORD
    );
    expect(passwordSlot?.salt).toBe(NEW_WRAP_SALT);
    expect(passwordSlot?.wrapBlob).toBe(NEW_WRAP);
    expect(meBody.multifactorEnabled).toBe(false);
  });

  test("begin with password-only vault returns 200 without email", async () => {
    const { app, services } = await createTestApp({ username: "gina", password: "password123" });
    const token = await loginViaApp(app, "gina", "password123");

    await app.request(API.users.me.patch, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recoveryEmail: "gina@example.com",
        currentPassword: "password123",
      }),
    });

    const initResponse = await app.request(API.users.me.vault.initialize, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slots: [
          {
            slotType: VAULT_SLOT_TYPE_PASSWORD,
            salt: DUMMY_SALT,
            wrapBlob: DUMMY_WRAP,
            password: "password123",
          },
        ],
      }),
    });
    expect(initResponse.status).toBe(201);

    services.emailSender.clearMessages();
    const beginResponse = await app.request(API.auth.recovery.advanced.begin, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "gina", email: "gina@example.com" }),
    });
    expect(beginResponse.status).toBe(200);
    expect(services.emailSender.messages).toHaveLength(0);
  });

  test("advanced context rejects invalid token", async () => {
    const { app } = await createTestApp();

    const response = await app.request(API.auth.recovery.advanced.context, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "not-a-valid-token" }),
    });

    expect(response.status).toBe(400);
  });

  test("advanced complete rejects invalid token", async () => {
    const { app } = await createTestApp();

    const response = await app.request(API.auth.recovery.advanced.complete, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "not-a-valid-token",
        newPassword: "newpassword456",
      }),
    });

    expect(response.status).toBe(400);
  });

  test("advanced webauthn begin rejects invalid token", async () => {
    const { app } = await createTestApp();

    const response = await app.request(API.auth.recovery.advanced.webauthn, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "not-a-valid-token" }),
    });

    expect(response.status).toBe(400);
  });
});
