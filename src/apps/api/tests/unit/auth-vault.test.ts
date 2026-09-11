import { describe, expect, test } from "bun:test";
import { createApp } from "@ndb/api";
import { API } from "@ndb/platform";
import {
  readApiJson,
  type UserResponse,
  type VaultInitializeResponse,
  type VaultSlotResponse,
} from "@tests/api/helpers/api-response";
import { createAuthTestServices, loginViaApp } from "@tests/api/helpers/auth-services";
import { fakeConfig } from "@tests/api/helpers/config";
import { createMemoryLogger } from "@tests/api/helpers/memory.logger";

const DUMMY_SALT = "AQIDBAUGBwgJCgsMDQ4PEA";
const DUMMY_WRAP = "abc.def";

describe("auth vault routes", () => {
  test("POST /api/v1/users/me/vault/initialize stores slots and GET /me returns them", async () => {
    const services = await createAuthTestServices("vaultuser", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "vaultuser", "password123");

    const initialize = await app.request(API.users.me.vault.initialize, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slots: [
          {
            slot_type: "password",
            salt: DUMMY_SALT,
            wrap_blob: DUMMY_WRAP,
            password: "password123",
          },
        ],
      }),
    });

    expect(initialize.status).toBe(201);
    const initializeBody = await readApiJson<VaultInitializeResponse>(initialize);
    expect(initializeBody.data.vault_slots).toHaveLength(1);
    expect(initializeBody.data.vault_slots[0].slot_type).toBe("password");

    const me = await app.request(API.users.me.details, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(me.status).toBe(200);
    const meBody = await readApiJson<UserResponse>(me);
    expect(meBody.data.vault_initialized).toBe(true);
    expect(meBody.data.vault_slots).toHaveLength(1);
    expect(meBody.data.vault_slots[0].slot_type).toBe("password");
    expect(meBody.data.vault_slots[0].salt).toBe(DUMMY_SALT);
    expect(meBody.data.vault_slots[0].wrap_blob).toBe(DUMMY_WRAP);
  });

  test("POST /api/v1/users/me/vault/initialize rejects plaintext recovery secrets", async () => {
    const services = await createAuthTestServices("phraseuser", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "phraseuser", "password123");

    const response = await app.request(API.users.me.vault.initialize, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phrase:
          "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
        slots: [
          {
            slot_type: "recovery_phrase",
            salt: DUMMY_SALT,
            wrap_blob: DUMMY_WRAP,
          },
        ],
      }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(String(body.error)).toContain(
      "core.auth.vault.initialize.invalid.plaintext-recovery-secrets"
    );
  });

  test("PATCH /api/v1/users/me updates display_name after the vault exists", async () => {
    const services = await createAuthTestServices("nameuser", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "nameuser", "password123");

    await app.request(API.users.me.vault.initialize, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slots: [
          {
            slot_type: "password",
            salt: DUMMY_SALT,
            wrap_blob: DUMMY_WRAP,
            password: "password123",
          },
        ],
      }),
    });

    const patch = await app.request(API.users.me.update, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ display_name: DUMMY_WRAP }),
    });

    expect(patch.status).toBe(200);
    const patchBody = await readApiJson<null>(patch);
    expect(patchBody).toEqual({ data: null, errors: [] });

    const me = await app.request(API.users.me.details, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meBody = await readApiJson<UserResponse>(me);
    expect(meBody.data.display_name).toBe(DUMMY_WRAP);
  });

  test("PUT and DELETE /api/v1/users/me/vault/slots manage slots", async () => {
    const services = await createAuthTestServices("slotuser", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "slotuser", "password123");

    const initialize = await app.request(API.users.me.vault.initialize, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slots: [
          {
            slot_type: "password",
            salt: DUMMY_SALT,
            wrap_blob: DUMMY_WRAP,
            password: "password123",
          },
        ],
      }),
    });
    const initializeBody = await readApiJson<VaultInitializeResponse>(initialize);
    const slotId = initializeBody.data.vault_slots[0].id;

    const addResponse = await app.request(API.users.me.vault.slots.list, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slot_type: "recovery_phrase",
        salt: "BQIDBAUGBwgJCgsMDQ4PEB",
        wrap_blob: "ghi.jkl",
        label: "backup phrase",
      }),
    });
    expect(addResponse.status).toBe(201);
    const phraseSlotId = (await readApiJson<VaultSlotResponse>(addResponse)).data.id;

    const rotateResponse = await app.request(
      API.users.me.vault.slots.details.replace(":id", slotId),
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          salt: "CQIDBAUGBwgJCgsMDQ4PEC",
          wrap_blob: "mno.pqr",
        }),
      }
    );
    expect(rotateResponse.status).toBe(200);

    const deleteResponse = await app.request(
      API.users.me.vault.slots.details.replace(":id", phraseSlotId),
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );
    expect(deleteResponse.status).toBe(200);
  });
});
