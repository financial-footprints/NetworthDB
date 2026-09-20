import { describe, expect, test } from "bun:test";
import { parseLoginResponse } from "@platform/http/endpoints/auth/parse-login";

describe("parseLoginResponse", () => {
  test("parses a successful password login with envelope", () => {
    const result = parseLoginResponse({
      data: {
        sessionToken: "access",
        refreshToken: "refresh",
        expiresIn: 900,
      },
    });

    expect(result).toEqual({
      kind: "authenticated",
      tokens: {
        sessionToken: "access",
        refreshToken: "refresh",
        expiresIn: 900,
      },
    });
  });

  test("parses unwrapped login data after client unwrap", () => {
    const result = parseLoginResponse({
      sessionToken: "access",
      refreshToken: "refresh",
      expiresIn: 900,
    });

    expect(result).toEqual({
      kind: "authenticated",
      tokens: {
        sessionToken: "access",
        refreshToken: "refresh",
        expiresIn: 900,
      },
    });
  });

  test("parses a multifactor challenge", () => {
    const result = parseLoginResponse({
      data: {
        status: "multifactor_required",
        multifactorToken: "mfa-token",
        expiresIn: 300,
        methods: ["totp", "webauthn"],
      },
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
      data: {
        status: "multifactor_enrollment_required",
        multifactorToken: "mfa-token",
        expiresIn: 300,
        methods: ["totp"],
      },
    });

    expect(result).toEqual({
      kind: "multifactor_enrollment_required",
      multifactorToken: "mfa-token",
      expiresIn: 300,
      methods: ["totp"],
    });
  });

  test("throws for unexpected payloads", () => {
    expect(() => parseLoginResponse({ data: { status: "multifactor_required" } })).toThrow(
      "Unexpected login response from auth service."
    );
    expect(() => parseLoginResponse(null)).toThrow("Unexpected login response from auth service.");
  });
});
