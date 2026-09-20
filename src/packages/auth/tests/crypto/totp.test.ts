import { describe, expect, test } from "bun:test";
import { createTotpEngine } from "@auth/crypto/totp";

describe("createTotpEngine", () => {
  test("generates secrets and validates codes", () => {
    const totp = createTotpEngine();
    const generated = totp.generateSecret("alice");
    expect(generated.secret.length).toBeGreaterThan(0);
    expect(generated.uri).toContain("otpauth://");

    const code = totp.validate(generated.secret, "000000", 1, null);
    expect(code.valid).toBe(false);
  });

  test("returns current step", () => {
    const totp = createTotpEngine();
    expect(totp.currentStep()).toBeGreaterThan(0);
  });
});
