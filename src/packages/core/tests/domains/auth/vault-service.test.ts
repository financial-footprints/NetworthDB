import { describe, expect, test } from "bun:test";
import {
  MAX_RECOVERY_PHRASE_SLOTS,
  VAULT_SLOT_TYPE_PASSWORD,
  VAULT_SLOT_TYPE_RECOVERY_PHRASE,
} from "@core/domains/user/modules/vault/embedded/vault-wrap";
import type { VaultSlotInput } from "@core/domains/user/modules/vault/types";
import { ConflictError, ValidationError } from "@core/shared/errors/domain-error";
import { firstElement } from "@tests/core/helpers/assert";
import { createTestAuthServices } from "@tests/core/helpers/auth";
import { getByUsername } from "@tests/core/helpers/helpers";

const DUMMY_SALT = "AQIDBAUGBwgJCgsMDQ4PEA";
const DUMMY_WRAP = "abc.def";

describe("VaultService", () => {
  test("initialize creates a password slot", async () => {
    const services = await createTestAuthServices("vaultuser", "password123");
    const user = await getByUsername(services.users, "vaultuser");

    const slots = await services.vault.initialize(user.id, "aal1", [
      {
        slotType: VAULT_SLOT_TYPE_PASSWORD,
        salt: DUMMY_SALT,
        wrapBlob: DUMMY_WRAP,
        password: "password123",
      },
    ]);

    expect(slots).toHaveLength(1);
    const state = await services.vault.get(user.id);
    expect(state.e2eeVaultInitialized).toBe(true);
    expect(state.e2eeSlots[0]?.slotType).toBe(VAULT_SLOT_TYPE_PASSWORD);
  });

  test("initialize stores optional e2ee_name", async () => {
    const services = await createTestAuthServices("nameinit", "password123");
    const user = await getByUsername(services.users, "nameinit");

    await services.vault.initialize(
      user.id,
      "aal1",
      [
        {
          slotType: VAULT_SLOT_TYPE_PASSWORD,
          salt: DUMMY_SALT,
          wrapBlob: DUMMY_WRAP,
          password: "password123",
        },
      ],
      DUMMY_WRAP
    );

    const state = await services.vault.get(user.id);
    expect(state.e2eeName).toBe(DUMMY_WRAP);
  });

  test("initialize rejects a second password slot", async () => {
    const services = await createTestAuthServices("dupuser", "password123");
    const user = await getByUsername(services.users, "dupuser");

    await expect(
      services.vault.initialize(user.id, "aal1", [
        {
          slotType: VAULT_SLOT_TYPE_PASSWORD,
          salt: DUMMY_SALT,
          wrapBlob: DUMMY_WRAP,
          password: "password123",
        },
        {
          slotType: VAULT_SLOT_TYPE_PASSWORD,
          salt: DUMMY_SALT,
          wrapBlob: DUMMY_WRAP,
          password: "password123",
        },
      ])
    ).rejects.toThrow(ConflictError);
  });

  test("cannot delete the last vault slot", async () => {
    const services = await createTestAuthServices("lastslot", "password123");
    const user = await getByUsername(services.users, "lastslot");
    const slots = await services.vault.initialize(user.id, "aal1", [
      {
        slotType: VAULT_SLOT_TYPE_PASSWORD,
        salt: DUMMY_SALT,
        wrapBlob: DUMMY_WRAP,
        password: "password123",
      },
    ]);

    await expect(
      services.vault.delete(user.id, "aal1", firstElement(slots, "vault slot").id, "password123")
    ).rejects.toThrow(ConflictError);
  });

  test("updateSealedName requires an initialized vault", async () => {
    const services = await createTestAuthServices("noname", "password123");
    const user = await getByUsername(services.users, "noname");

    await expect(services.vault.update(user.id, "abc.def")).rejects.toThrow(ConflictError);
  });

  test("phrase slot cap is enforced", async () => {
    const services = await createTestAuthServices("phrasecap", "password123");
    const user = await getByUsername(services.users, "phrasecap");

    const phraseSlots: VaultSlotInput[] = Array.from(
      { length: MAX_RECOVERY_PHRASE_SLOTS },
      (_, index) => ({
        slotType: VAULT_SLOT_TYPE_RECOVERY_PHRASE,
        salt: DUMMY_SALT,
        wrapBlob: DUMMY_WRAP,
        label: `phrase-${index}`,
      })
    );

    await services.vault.initialize(user.id, "aal1", phraseSlots);

    await expect(
      services.vault.create(user.id, "aal1", {
        slotType: VAULT_SLOT_TYPE_RECOVERY_PHRASE,
        salt: DUMMY_SALT,
        wrapBlob: DUMMY_WRAP,
        label: "overflow",
        password: "password123",
      })
    ).rejects.toThrow(ConflictError);
  });

  test("initialize rejects invalid wrap blobs", async () => {
    const services = await createTestAuthServices("badwrap", "password123");
    const user = await getByUsername(services.users, "badwrap");

    await expect(
      services.vault.initialize(user.id, "aal1", [
        {
          slotType: VAULT_SLOT_TYPE_PASSWORD,
          salt: DUMMY_SALT,
          wrapBlob: "no-separator",
          password: "password123",
        },
      ])
    ).rejects.toThrow(ValidationError);
  });
});
