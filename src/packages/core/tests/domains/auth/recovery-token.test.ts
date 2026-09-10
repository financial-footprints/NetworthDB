import { describe, expect, test } from "bun:test";
import { normalizeRecoverySecret } from "@core/domains/auth/modules/recovery/embedded/recovery-codes";
import {
  generateRecoveryToken,
  hashRecoverySecret,
  validateRecoveryEmail,
} from "@core/domains/auth/modules/recovery/embedded/recovery-token";
import { ValidationError } from "@core/shared/errors/domain-error";

describe("recovery token helpers", () => {
  test("generateRecoveryToken returns url-safe tokens", () => {
    const token = generateRecoveryToken();
    expect(token.length).toBeGreaterThan(20);
    expect(token).not.toContain("+");
    expect(token).not.toContain("/");
  });

  test("hashRecoverySecret normalizes dashes and case", () => {
    const plain = "abcd-efgh-IJKL-mnop";
    const hashA = hashRecoverySecret(plain);
    const hashB = hashRecoverySecret(plain.toLowerCase());
    expect(hashA).toBe(hashB);
    expect(normalizeRecoverySecret(" ab-cd ")).toBe("ABCD");
  });

  test("validateRecoveryEmail rejects invalid addresses", () => {
    expect(() => validateRecoveryEmail("")).toThrow(ValidationError);
    expect(() => validateRecoveryEmail("not-an-email")).toThrow(ValidationError);
    validateRecoveryEmail("user@example.com");
  });
});
