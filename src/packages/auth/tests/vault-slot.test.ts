import { describe, expect, test } from "bun:test";
import { VAULT_SLOT_TYPE_PASSWORD } from "@core/domains/user/modules/vault/constants";
import { VaultSlot } from "@core/domains/user/modules/vault/entities/vault-slot";
import { ValidationError } from "@core/shared/errors/domain-error";

const DUMMY_USER_ID = "10000000-0000-4000-8000-000000000001";
const DUMMY_SALT = "AQIDBAUGBwgJCgsMDQ4PEA";
const DUMMY_WRAP = "abc.def";

describe("VaultSlot", () => {
  test("create accepts valid password slot", () => {
    const slot = VaultSlot.create({
      userId: DUMMY_USER_ID,
      slotType: VAULT_SLOT_TYPE_PASSWORD,
      salt: DUMMY_SALT,
      wrapBlob: DUMMY_WRAP,
    });

    expect(slot.slotType).toBe(VAULT_SLOT_TYPE_PASSWORD);
    expect(slot.salt).toBe(DUMMY_SALT);
    expect(slot.wrapBlob).toBe(DUMMY_WRAP);
  });

  test("withWrap validates salt and wrap blob", () => {
    const slot = VaultSlot.create({
      userId: DUMMY_USER_ID,
      slotType: VAULT_SLOT_TYPE_PASSWORD,
      salt: DUMMY_SALT,
      wrapBlob: DUMMY_WRAP,
    });

    const updated = slot.withWrap(DUMMY_SALT, DUMMY_WRAP, new Date());
    expect(updated.wrapBlob).toBe(DUMMY_WRAP);
  });

  test("create rejects invalid slot type", () => {
    expect(() =>
      VaultSlot.create({
        userId: DUMMY_USER_ID,
        slotType: "invalid",
        salt: DUMMY_SALT,
        wrapBlob: DUMMY_WRAP,
      })
    ).toThrow(ValidationError);
  });

  test("create rejects invalid wrap blob format", () => {
    expect(() =>
      VaultSlot.create({
        userId: DUMMY_USER_ID,
        slotType: VAULT_SLOT_TYPE_PASSWORD,
        salt: DUMMY_SALT,
        wrapBlob: "",
      })
    ).toThrow(ValidationError);

    expect(() =>
      VaultSlot.create({
        userId: DUMMY_USER_ID,
        slotType: VAULT_SLOT_TYPE_PASSWORD,
        salt: DUMMY_SALT,
        wrapBlob: "no-separator",
      })
    ).toThrow(ValidationError);
  });

  test("parseCredentialId rejects invalid values", () => {
    expect(() => VaultSlot.parseCredentialId("")).toThrow(ValidationError);
    expect(() => VaultSlot.parseCredentialId("not-base64url!!!")).toThrow(ValidationError);
  });

  test("encodeCredentialId round-trips with parseCredentialId", () => {
    const raw = new Uint8Array([1, 2, 3, 255]);
    const encoded = VaultSlot.encodeCredentialId(raw);
    expect(VaultSlot.parseCredentialId(encoded).equals(Buffer.from(raw))).toBe(true);
  });
});
