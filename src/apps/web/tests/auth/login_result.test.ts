import { describe, expect, test } from "bun:test";
import { parseLoginResponse } from "@web/utils/api/endpoints/auth/http";

describe("parseLoginResponse", () => {
  test("parses a successful password login", () => {
    const result = parseLoginResponse({
      session_token: "access",
      refresh_token: "refresh",
      expires_in: 900,
    });

    expect(result).toEqual({
      kind: "authenticated",
      tokens: {
        session_token: "access",
        refresh_token: "refresh",
        expires_in: 900,
      },
    });
  });

  test("parses a multifactor challenge", () => {
    const result = parseLoginResponse({
      status: "multifactor_required",
      multifactor_token: "mfa-token",
      expires_in: 300,
      methods: ["totp", "webauthn"],
    });

    expect(result).toEqual({
      kind: "multifactor_required",
      multifactorToken: "mfa-token",
      expiresIn: 300,
      methods: ["totp", "webauthn"],
    });
  });

  test("parses a multifactor enrollment challenge", () => {
    const result = parseLoginResponse({
      status: "multifactor_enrollment_required",
      multifactor_token: "mfa-token",
      expires_in: 300,
      methods: ["totp"],
    });

    expect(result).toEqual({
      kind: "multifactor_enrollment_required",
      multifactorToken: "mfa-token",
      expiresIn: 300,
      methods: ["totp"],
    });
  });

  test("throws for unexpected payloads", () => {
    expect(() => parseLoginResponse({ status: "multifactor_required" })).toThrow(
      "Unexpected login response from auth service."
    );
    expect(() => parseLoginResponse(null)).toThrow("Unexpected login response from auth service.");
  });
});
