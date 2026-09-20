import { describe, expect, test } from "bun:test";
import { patchMeReqSchema } from "@platform/http/endpoints/auth/account";
import { userIdParamsSchema } from "@platform/http/endpoints/auth/admin";
import { loginReqSchema, refreshReqSchema } from "@platform/http/endpoints/auth/session";
import { vaultSlotInputSchema } from "@platform/http/endpoints/auth/vault";

describe("auth request schemas", () => {
  test("loginReqSchema rejects empty username", () => {
    const result = loginReqSchema.safeParse({ username: "", password: "secret" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Username is required.");
    }
  });

  test("refreshReqSchema requires refreshToken", () => {
    const result = refreshReqSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Refresh token is required.");
    }
  });

  test("patchMeReqSchema rejects empty patch body", () => {
    const result = patchMeReqSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("No fields to update.");
    }
  });

  test("userIdParamsSchema rejects invalid uuid", () => {
    const result = userIdParamsSchema.safeParse({ userId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  test("userIdParamsSchema accepts a valid uuid", () => {
    const result = userIdParamsSchema.safeParse({
      userId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  test("vaultSlotInputSchema rejects invalid slot type", () => {
    const result = vaultSlotInputSchema.safeParse({
      slotType: "invalid",
      salt: "salt",
      wrapBlob: "blob",
      label: "primary",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Vault slot type is invalid.");
    }
  });
});
