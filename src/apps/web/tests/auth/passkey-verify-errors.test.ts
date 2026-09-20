import { describe, expect, test } from "bun:test";
import { passkeyVerifyErrorMessage } from "@web/components/Auth/helpers";
import { ApiError } from "@web/utils/api/types";

describe("passkeyVerifyErrorMessage", () => {
  test("maps unauthorized to expired MFA session message", () => {
    const error = new ApiError(401, "unauthorized");
    expect(passkeyVerifyErrorMessage(error)).toBe(
      "Your MFA session expired. Go back and sign in again."
    );
  });

  test("maps invalid credentials to passkey-specific message", () => {
    const error = new ApiError(401, "invalid credentials");
    expect(passkeyVerifyErrorMessage(error)).toBe(
      "Passkey verification failed. Check you selected the correct passkey and try again."
    );
  });

  test("falls back to API details when present", () => {
    const error = new ApiError(401, "custom server message");
    expect(passkeyVerifyErrorMessage(error)).toBe("custom server message");
  });
});
