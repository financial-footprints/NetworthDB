import { describe, expect, test } from "bun:test";
import {
  currentTotpStep,
  generateTotpSecret,
  validateTotpCode,
} from "@core/domains/auth/modules/multifactor/embedded/totp";
import { Secret, TOTP } from "otpauth";

const TOTP_PERIOD = 30;

function createTotp(secretBase32: string): TOTP {
  return new TOTP({
    secret: Secret.fromBase32(secretBase32),
    algorithm: "SHA1",
    digits: 6,
    period: TOTP_PERIOD,
  });
}

function generateCode(secretBase32: string): string {
  return createTotp(secretBase32).generate();
}

function generateNextCode(secretBase32: string): string {
  const nextStep = currentTotpStep() + 1;

  return createTotp(secretBase32).generate({ timestamp: nextStep * TOTP_PERIOD * 1000 });
}

describe("totp", () => {
  test("generates a provisioning URI with NetworthDB issuer", () => {
    const generated = generateTotpSecret("alice");
    expect(generated.uri).toContain("issuer=NetworthDB");
    expect(generated.uri).toContain("alice");
  });

  test("validates a current code and rejects replay", () => {
    const generated = generateTotpSecret("alice");
    const code = generateCode(generated.secret);
    const first = validateTotpCode(generated.secret, code, 1, null);

    expect(first.valid).toBe(true);
    expect(validateTotpCode(generated.secret, code, 1, first.step).valid).toBe(false);
  });

  test("accepts next-window code after current step is consumed", () => {
    const generated = generateTotpSecret("alice");
    const code = generateCode(generated.secret);
    const first = validateTotpCode(generated.secret, code, 1, null);

    expect(first.valid).toBe(true);

    const nextCode = generateNextCode(generated.secret);
    expect(validateTotpCode(generated.secret, nextCode, 1, first.step).valid).toBe(true);
  });

  test("currentTotpStep matches the validation window", () => {
    expect(currentTotpStep()).toBe(Math.floor(Date.now() / 1000 / 30));
  });
});
