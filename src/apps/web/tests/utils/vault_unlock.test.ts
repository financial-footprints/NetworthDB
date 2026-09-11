import { expect, test } from "bun:test";
import type { MeResponse } from "@web/utils/api/endpoints/auth/types";
import {
  createRecoveryPhraseSlot,
  createVault,
  credentialIdsMatch,
  listUnlockMethods,
  tryAutoUnlock,
  wrapDEKForSlot,
} from "@web/utils/crypto/vault";

const phrase =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

function meWithSlots(slots: MeResponse["vault_slots"], initialized = true): MeResponse {
  return {
    id: "user-1",
    username: "alice",
    role: "user",
    multifactor_enabled: false,
    multifactor_methods: [],
    recovery_codes_enabled: false,
    recovery_email_enabled: false,
    recovery_email_set_at: null,
    vault_initialized: initialized,
    vault_slots: slots,
    display_name: null,
  };
}

test("listUnlockMethods reflects configured slot types", async () => {
  const { dek, slots } = await createVault("login-password");
  const recovery = await createRecoveryPhraseSlot(dek, phrase);
  const methods = listUnlockMethods([...slots, recovery]);
  expect(methods).toEqual(["password", "recovery_phrase"]);
});

test("tryAutoUnlock unlocks with login password when password slot exists", async () => {
  const { slots } = await createVault("login-password");
  const me = meWithSlots(
    slots.map((slot, index) => ({
      id: `slot-${index}`,
      slot_type: slot.slot_type,
      salt: slot.salt,
      wrap_blob: slot.wrap_blob,
      credential_id: null,
      label: "",
    }))
  );

  const result = await tryAutoUnlock(me, { password: "login-password" });
  expect(result.kind).toBe("unlocked");
  if (result.kind === "unlocked") {
    expect(result.dek.type).toBe("secret");
  }
});

test("tryAutoUnlock requires manual unlock when only recovery phrase slots exist", async () => {
  const { dek } = await createVault("unused-login-password");
  const recovery = await createRecoveryPhraseSlot(dek, phrase);
  const me = meWithSlots([
    {
      id: "recovery-1",
      slot_type: recovery.slot_type,
      salt: recovery.salt,
      wrap_blob: recovery.wrap_blob,
      credential_id: null,
      label: "",
    },
  ]);

  const result = await tryAutoUnlock(me, { password: "unused-login-password" });
  expect(result).toEqual({
    kind: "manual_required",
    methods: ["recovery_phrase"],
  });
});

test("tryAutoUnlock returns no_vault when vault is not initialized", async () => {
  const result = await tryAutoUnlock(meWithSlots([], false), {
    password: "login-password",
  });
  expect(result).toEqual({ kind: "no_vault" });
});

test("tryAutoUnlock unlocks with matching webauthn PRF slot", async () => {
  const dek = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const prfOutput = new Uint8Array(32);
  crypto.getRandomValues(prfOutput);
  const credentialId = "cred-abc";
  const wrapped = await wrapDEKForSlot(dek, "webauthn_prf", prfOutput);
  const me = meWithSlots([
    {
      id: "prf-1",
      slot_type: "webauthn_prf",
      salt: wrapped.salt,
      wrap_blob: wrapped.wrap_blob,
      credential_id: credentialId,
      label: "Primary passkey",
    },
  ]);

  const result = await tryAutoUnlock(me, {
    webauthn: { credentialId, prfOutput },
  });
  expect(result.kind).toBe("unlocked");
});

test("credentialIdsMatch accepts equivalent base64url encodings", () => {
  expect(credentialIdsMatch("AQID", "AQID")).toBe(true);
});
