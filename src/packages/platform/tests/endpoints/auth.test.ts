import { describe, expect, test } from "bun:test";
import { patchMeReqSchema } from "@platform/endpoints/auth/account";
import { uuidIdParamsSchema } from "@platform/endpoints/auth/admin";
import { loginReqSchema, refreshReqSchema } from "@platform/endpoints/auth/session";
import { vaultSlotInputSchema } from "@platform/endpoints/auth/vault";

describe("auth request schemas", () => {
  test("loginReqSchema rejects empty username", () => {
    const result = loginReqSchema.safeParse({ username: "", password: "secret" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("api.auth.login.invalid.username-required");
    }
  });

  test("refreshReqSchema requires refresh_token", () => {
    const result = refreshReqSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("api.auth.refresh.invalid.token-required");
    }
  });

  test("patchMeReqSchema rejects empty patch body", () => {
    const result = patchMeReqSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("api.auth.account.patch.invalid.no-fields");
    }
  });

  test("uuidIdParamsSchema rejects invalid uuid", () => {
    const result = uuidIdParamsSchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  test("uuidIdParamsSchema accepts a valid uuid", () => {
    const result = uuidIdParamsSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  test("vaultSlotInputSchema rejects invalid slot type", () => {
    const result = vaultSlotInputSchema.safeParse({
      slot_type: "invalid",
      salt: "salt",
      wrap_blob: "blob",
      label: "primary",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("api.auth.vault.slot.invalid.type");
    }
  });
});
