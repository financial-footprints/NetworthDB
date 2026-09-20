import { describe, expect, test } from "bun:test";
import { API, apiPath } from "@ndb/platform";
import {
  readApiData,
  readApiJson,
  type UserResponse,
  type VaultInitializeResponse,
} from "@tests/api/helpers/api-response";
import { loginViaApp } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";

const DUMMY_SALT = "AQIDBAUGBwgJCgsMDQ4PEA";
const DUMMY_WRAP = "abc.def";

describe("auth vault routes", () => {
  test("POST /api/v1/users/me/vault/initialize stores slots and GET /me returns them", async () => {
    const { app } = await createTestApp({
      username: "vaultuser",
      password: "password123",
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
            slotType: "password",
            salt: DUMMY_SALT,
            wrapBlob: DUMMY_WRAP,
            password: "password123",
          },
        ],
      }),
    });

    expect(initialize.status).toBe(201);
    const initializeBody = await readApiData<VaultInitializeResponse>(initialize);
    expect(initializeBody.vaultSlots).toHaveLength(1);
    expect(initializeBody.vaultSlots[0].slotType).toBe("password");

    const me = await app.request(API.users.me.get, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(me.status).toBe(200);
    const meBody = await readApiData<UserResponse>(me);
    expect(meBody.vaultInitialized).toBe(true);
    expect(meBody.vaultSlots).toHaveLength(1);
    expect(meBody.vaultSlots[0].slotType).toBe("password");
    expect(meBody.vaultSlots[0].salt).toBe(DUMMY_SALT);
    expect(meBody.vaultSlots[0].wrapBlob).toBe(DUMMY_WRAP);
  });

  test("POST /api/v1/users/me/vault/initialize rejects plaintext recovery secrets", async () => {
    const { app } = await createTestApp({
      username: "phraseuser",
      password: "password123",
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
            slotType: "recovery_phrase",
            salt: DUMMY_SALT,
            wrapBlob: DUMMY_WRAP,
          },
        ],
      }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(String(body.error)).toContain("Recovery secrets must not be sent as plaintext");
  });

  test("PATCH /api/v1/users/me updates displayName after the vault exists", async () => {
    const { app } = await createTestApp({
      username: "nameuser",
      password: "password123",
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
            slotType: "password",
            salt: DUMMY_SALT,
            wrapBlob: DUMMY_WRAP,
            password: "password123",
          },
        ],
      }),
    });

    const patch = await app.request(API.users.me.patch, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayName: DUMMY_WRAP }),
    });

    expect(patch.status).toBe(200);
    const patchBody = await readApiJson<{ data: null }>(patch);
    expect(patchBody).toEqual({ data: null });

    const me = await app.request(API.users.me.get, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meBody = await readApiData<UserResponse>(me);
    expect(meBody.displayName).toBe(DUMMY_WRAP);
  });

  test("PUT and DELETE /api/v1/users/me/vault/slots manage slots", async () => {
    const { app } = await createTestApp({
      username: "slotuser",
      password: "password123",
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
            slotType: "password",
            salt: DUMMY_SALT,
            wrapBlob: DUMMY_WRAP,
            password: "password123",
          },
        ],
      }),
    });
    const initializeBody = await readApiData<VaultInitializeResponse>(initialize);
    const slotId = initializeBody.vaultSlots[0]?.id;
    if (!slotId) {
      throw new Error("password slot id missing");
    }

    const addResponse = await app.request(API.users.me.vault.slots.create, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slotType: "recovery_phrase",
        salt: "BQIDBAUGBwgJCgsMDQ4PEB",
        wrapBlob: "ghi.jkl",
        label: "backup phrase",
      }),
    });
    expect(addResponse.status).toBe(201);
    const phraseSlotId = (await readApiData<{ id: string }>(addResponse)).id;
    if (!phraseSlotId) {
      throw new Error("phrase slot id missing");
    }

    const rotateResponse = await app.request(apiPath(API.users.me.vault.slots.patch, { slotId }), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        salt: "CQIDBAUGBwgJCgsMDQ4PEC",
        wrapBlob: "mno.pqr",
      }),
    });
    expect(rotateResponse.status).toBe(200);

    const deleteResponse = await app.request(
      apiPath(API.users.me.vault.slots.delete, { slotId: phraseSlotId }),
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );
    expect(deleteResponse.status).toBe(204);
  });
});
