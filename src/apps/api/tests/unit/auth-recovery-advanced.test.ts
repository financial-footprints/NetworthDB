import { describe, expect, test } from "bun:test";
import { createApp } from "@ndb/api";
import { VAULT_SLOT_TYPE_PASSWORD, VAULT_SLOT_TYPE_RECOVERY_PHRASE } from "@ndb/core";
import { API } from "@ndb/platform";
import {
  type AdvancedRecoveryContextResponse,
  type PublicUserResponse,
  readApiJson,
  type SessionTokenPair,
} from "@tests/api/helpers/api-response";
import { createAuthTestServices, loginAs } from "@tests/api/helpers/auth-services";
import { fakeConfig } from "@tests/api/helpers/config";
import { createMemoryLogger } from "@tests/api/helpers/memory.logger";
import { firstElement } from "@tests/core/helpers/assert";
import { tokenFromEmail } from "@tests/core/helpers/auth";

const DUMMY_SALT = "AQIDBAUGBwgJCgsMDQ4PEA";
const DUMMY_WRAP = "abc.def";
const PHRASE_SALT = "BQIDBAUGBwgJCgsMDQ4PEB";
const PHRASE_WRAP = "ghi.jkl";
const NEW_WRAP_SALT = "CQIDBAUGBwgJCgsMDQ4PEC";
const NEW_WRAP = "mno.pqr";

describe("auth advanced recovery routes", () => {
  test("begin → context → complete clears MFA and updates password wrap", async () => {
    const services = await createAuthTestServices("frank", "password123");
    const token = await loginAs(services, "frank", "password123");
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
        recovery_email: "frank@example.com",
        current_password: "password123",
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
            slot_type: VAULT_SLOT_TYPE_PASSWORD,
            salt: DUMMY_SALT,
            wrap_blob: DUMMY_WRAP,
            password: "password123",
          },
          {
            slot_type: VAULT_SLOT_TYPE_RECOVERY_PHRASE,
            salt: PHRASE_SALT,
            wrap_blob: PHRASE_WRAP,
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
    const contextBody = await readApiJson<AdvancedRecoveryContextResponse>(contextResponse);
    expect(contextBody.data.e2ee_vault_initialized).toBe(true);
    expect(contextBody.data.vault_recovery_methods).toEqual([VAULT_SLOT_TYPE_RECOVERY_PHRASE]);

    const completeResponse = await app.request(API.auth.recovery.advanced.complete, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: recoveryToken,
        new_password: "resetpass789",
        password_slot: {
          salt: NEW_WRAP_SALT,
          wrap_blob: NEW_WRAP,
        },
      }),
    });
    expect(completeResponse.status).toBe(200);

    const loginResponse = await app.request(API.auth.session.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "frank", password: "resetpass789" }),
    });
    expect(loginResponse.status).toBe(200);

    const loginBody = await readApiJson<SessionTokenPair>(loginResponse);
    const meResponse = await app.request(API.users.me.details, {
      headers: { Authorization: `Bearer ${loginBody.data.session_token}` },
    });
    const meBody = await readApiJson<PublicUserResponse>(meResponse);
    const passwordSlot = meBody.data.e2ee_slots.find(
      (slot: { slot_type: string }) => slot.slot_type === VAULT_SLOT_TYPE_PASSWORD
    );
    expect(passwordSlot?.salt).toBe(NEW_WRAP_SALT);
    expect(passwordSlot?.wrap_blob).toBe(NEW_WRAP);
    expect(meBody.data.multifactor_enabled).toBe(false);
  });

  test("begin with password-only vault returns 200 without email", async () => {
    const services = await createAuthTestServices("gina", "password123");
    const token = await loginAs(services, "gina", "password123");
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
        recovery_email: "gina@example.com",
        current_password: "password123",
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
            slot_type: VAULT_SLOT_TYPE_PASSWORD,
            salt: DUMMY_SALT,
            wrap_blob: DUMMY_WRAP,
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
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const response = await app.request(API.auth.recovery.advanced.context, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "not-a-valid-token" }),
    });

    expect(response.status).toBe(400);
  });

  test("advanced complete rejects invalid token", async () => {
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const response = await app.request(API.auth.recovery.advanced.complete, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "not-a-valid-token",
        new_password: "newpassword456",
      }),
    });

    expect(response.status).toBe(400);
  });

  test("advanced webauthn begin rejects invalid token", async () => {
    const services = await createAuthTestServices();
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const response = await app.request(API.auth.recovery.advanced.webauthn, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "not-a-valid-token" }),
    });

    expect(response.status).toBe(400);
  });
});
