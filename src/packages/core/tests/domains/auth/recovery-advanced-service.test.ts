import { describe, expect, test } from "bun:test";
import { isSessionTokenPair } from "@core/domains/auth/helpers";
import {
  VAULT_SLOT_TYPE_PASSWORD,
  VAULT_SLOT_TYPE_RECOVERY_PHRASE,
} from "@core/domains/user/modules/vault/embedded/vault-wrap";
import { firstElement } from "@tests/core/helpers/assert";
import { createTestAuthServices, loginAsSession, tokenFromEmail } from "@tests/core/helpers/auth";
import { getByUsername } from "@tests/core/helpers/helpers";

const DUMMY_SALT = "AQIDBAUGBwgJCgsMDQ4PEA";
const DUMMY_WRAP = "abc.def";
const PHRASE_SALT = "BQIDBAUGBwgJCgsMDQ4PEB";
const PHRASE_WRAP = "ghi.jkl";
const NEW_WRAP_SALT = "CQIDBAUGBwgJCgsMDQ4PEC";
const NEW_WRAP = "mno.pqr";

describe("RecoveryService advanced recovery", () => {
  test("beginAdvanced sends email when phrase slot exists", async () => {
    const services = await createTestAuthServices("frank", "password123");
    const user = await getByUsername(services.users, "frank");

    await services.auth.recovery.updateEmail(user.id, "password123", "frank@example.com");
    await services.vault.initialize(user.id, "aal1", [
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
    ]);

    services.emailSender.clearMessages();
    const result = await services.auth.recovery.beginAdvanced("frank", "frank@example.com");
    expect(result.message).toContain("if an account exists");
    expect(services.emailSender.messages).toHaveLength(1);
    expect(services.emailSender.messages[0]?.subject).toBe("Advanced recovery request");
  });

  test("beginAdvanced does not email password-only vault", async () => {
    const services = await createTestAuthServices("gina", "password123");
    const user = await getByUsername(services.users, "gina");

    await services.auth.recovery.updateEmail(user.id, "password123", "gina@example.com");
    await services.vault.initialize(user.id, "aal1", [
      {
        slotType: VAULT_SLOT_TYPE_PASSWORD,
        salt: DUMMY_SALT,
        wrapBlob: DUMMY_WRAP,
        password: "password123",
      },
    ]);

    services.emailSender.clearMessages();
    const result = await services.auth.recovery.beginAdvanced("gina", "gina@example.com");
    expect(result.message).toContain("if an account exists");
    expect(services.emailSender.messages).toHaveLength(0);
  });

  test("advancedContext returns vault recovery methods", async () => {
    const services = await createTestAuthServices("hank", "password123");
    const user = await getByUsername(services.users, "hank");

    await services.auth.recovery.updateEmail(user.id, "password123", "hank@example.com");
    await services.vault.initialize(user.id, "aal1", [
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
    ]);

    await services.auth.recovery.beginAdvanced("hank", "hank@example.com");
    const recoveryToken = tokenFromEmail(firstElement(services.emailSender.messages, "email").body);
    const context = await services.auth.recovery.getContext(recoveryToken);

    expect(context.e2eeVaultInitialized).toBe(true);
    expect(context.vaultRecoveryMethods).toEqual([VAULT_SLOT_TYPE_RECOVERY_PHRASE]);
    expect(
      context.e2eeSlots.some((slot) => slot.slotType === VAULT_SLOT_TYPE_RECOVERY_PHRASE)
    ).toBe(true);
  });

  test("completeAdvanced clears MFA and upserts password wrap", async () => {
    const services = await createTestAuthServices("iris", "password123", "user", false);
    const user = await getByUsername(services.users, "iris");

    await services.auth.recovery.updateEmail(user.id, "password123", "iris@example.com");
    await services.vault.initialize(user.id, "aal1", [
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
    ]);

    const sessionToken = await loginAsSession(services, "iris", "password123");
    expect(sessionToken.length).toBeGreaterThan(0);

    services.emailSender.clearMessages();
    await services.auth.recovery.beginAdvanced("iris", "iris@example.com");
    const recoveryToken = tokenFromEmail(firstElement(services.emailSender.messages, "email").body);

    await services.auth.recovery.completeAdvanced({
      token: recoveryToken,
      newPassword: "resetpass789",
      passwordSlot: {
        salt: NEW_WRAP_SALT,
        wrapBlob: NEW_WRAP,
      },
    });

    const updated = await getByUsername(services.users, "iris");
    expect(updated.multifactorEnabled).toBe(false);
    expect(updated.totp.hasTotp()).toBe(false);

    const state = await services.vault.get(updated.id);
    const passwordSlot = state.e2eeSlots.find((slot) => slot.slotType === VAULT_SLOT_TYPE_PASSWORD);
    expect(passwordSlot?.salt).toBe(NEW_WRAP_SALT);
    expect(passwordSlot?.wrapBlob).toBe(NEW_WRAP);

    const login = await services.auth.login("iris", "resetpass789");
    expect(isSessionTokenPair(login)).toBe(true);
  });
});
