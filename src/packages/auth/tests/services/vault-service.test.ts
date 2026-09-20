import { describe, expect, test } from "bun:test";
import {
  MAX_RECOVERY_PHRASE_SLOTS,
  VAULT_SLOT_TYPE_PASSWORD,
  VAULT_SLOT_TYPE_RECOVERY_PHRASE,
  VAULT_SLOT_TYPE_WEBAUTHN_PRF,
} from "@core/domains/user/vault/constants";
import type { VaultSlotInput } from "@core/domains/user/vault/types";
import {
  BusinessRuleError,
  ConflictError,
  ValidationError,
} from "@core/shared/errors/domain-error";
import { firstElement } from "@ndb/core/tests";
import { createTestAuthServices } from "@tests/auth/helpers";
import { getByUsername } from "@tests/auth/helpers/helpers";

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
    expect(state.vaultInitialized).toBe(true);
    expect(state.vaultSlots[0]?.slotType).toBe(VAULT_SLOT_TYPE_PASSWORD);
  });

  test("initialize stores optional display_name", async () => {
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
    expect(state.displayName).toBe(DUMMY_WRAP);
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

  test("create rejects when vault is not initialized", async () => {
    const services = await createTestAuthServices("noinit", "password123");
    const user = await getByUsername(services.users, "noinit");

    await expect(
      services.vault.create(user.id, "aal1", {
        slotType: VAULT_SLOT_TYPE_PASSWORD,
        salt: DUMMY_SALT,
        wrapBlob: DUMMY_WRAP,
        password: "password123",
      })
    ).rejects.toThrow(BusinessRuleError);
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
    ).rejects.toThrow(BusinessRuleError);
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

  test("replaceFromBackup overwrites dest slots with backup wraps", async () => {
    const services = await createTestAuthServices("vaultrestore", "password123");
    const user = await getByUsername(services.users, "vaultrestore");
    await services.vault.initialize(user.id, "aal1", [
      {
        slotType: VAULT_SLOT_TYPE_PASSWORD,
        salt: DUMMY_SALT,
        wrapBlob: DUMMY_WRAP,
        password: "password123",
      },
    ]);

    const backupWrap = "backup.wrap";
    const result = await services.vault.replaceFromBackup(user.id, [
      {
        slotType: VAULT_SLOT_TYPE_PASSWORD,
        salt: DUMMY_SALT,
        wrapBlob: backupWrap,
      },
      {
        slotType: VAULT_SLOT_TYPE_RECOVERY_PHRASE,
        salt: DUMMY_SALT,
        wrapBlob: backupWrap,
        label: "phrase-1",
      },
    ]);

    expect(result.imported).toBe(2);
    expect(result.skippedPrf).toBe(0);
    const state = await services.vault.get(user.id);
    expect(state.vaultSlots).toHaveLength(2);
    expect(state.vaultSlots.every((slot) => slot.wrapBlob === backupWrap)).toBe(true);
  });

  test("replaceFromBackup skips unmatched PRF slots and fails when none remain", async () => {
    const services = await createTestAuthServices("vaultprf", "password123");
    const user = await getByUsername(services.users, "vaultprf");
    await services.vault.initialize(user.id, "aal1", [
      {
        slotType: VAULT_SLOT_TYPE_PASSWORD,
        salt: DUMMY_SALT,
        wrapBlob: DUMMY_WRAP,
        password: "password123",
      },
    ]);

    await expect(
      services.vault.replaceFromBackup(user.id, [
        {
          slotType: VAULT_SLOT_TYPE_WEBAUTHN_PRF,
          salt: DUMMY_SALT,
          wrapBlob: DUMMY_WRAP,
          credentialId: "AQID",
        },
      ])
    ).rejects.toThrow(ValidationError);

    const state = await services.vault.get(user.id);
    expect(state.vaultSlots).toHaveLength(1);
    expect(state.vaultSlots[0]?.slotType).toBe(VAULT_SLOT_TYPE_PASSWORD);
    expect(state.vaultSlots[0]?.wrapBlob).toBe(DUMMY_WRAP);
  });
});
