import { describe, expect, test } from "bun:test";
import { importDEK } from "@web/utils/crypto/aes";
import {
  isE2eeEnabled,
  parseClientSettings,
  resolveStoredField,
} from "@web/utils/crypto/client-settings";
import { sealField } from "@web/utils/crypto/vault";

describe("client settings", () => {
  test("defaults E2E fields to enabled", () => {
    expect(isE2eeEnabled(parseClientSettings(null), "display_name")).toBe(true);
    expect(isE2eeEnabled(parseClientSettings({}), "account_number")).toBe(true);
    expect(isE2eeEnabled(parseClientSettings({ e2ee: {} }), "display_name")).toBe(true);
  });

  test("honours explicit disable flags", () => {
    const settings = parseClientSettings({ e2ee: { displayName: false } });
    expect(isE2eeEnabled(settings, "display_name")).toBe(false);
  });

  test("parses active_period without e2ee", () => {
    const settings = parseClientSettings({
      active_period: { preset: "this_month" },
    });
    expect(settings.active_period).toEqual({ preset: "this_month" });
    expect(isE2eeEnabled(settings, "display_name")).toBe(true);
  });

  test("resolveStoredField seals or sends plaintext", async () => {
    const dek = await importDEK(crypto.getRandomValues(new Uint8Array(32)));
    const sealed = await resolveStoredField(dek, "Alice", true);
    expect(sealed).not.toBe("Alice");
    expect(await resolveStoredField(dek, "Alice", false)).toBe("Alice");
    expect(await resolveStoredField(null, "Bob", false)).toBe("Bob");
  });

  test("sealed values differ from plaintext", async () => {
    const dek = await importDEK(crypto.getRandomValues(new Uint8Array(32)));
    const blob = await sealField(dek, "secret");
    expect(blob).not.toBe("secret");
  });
});
