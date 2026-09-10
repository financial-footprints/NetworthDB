import { describe, expect, test } from "bun:test";
import {
  decryptSecret,
  encryptSecret,
  generateSessionToken,
  hashSessionToken,
} from "@core/domains/auth/embedded/crypto";
import { TEST_MFA_ENCRYPTION_KEY } from "@tests/core/helpers/auth";

describe("crypto", () => {
  describe("session tokens", () => {
    test("generates a 64-character hex token", () => {
      const token = generateSessionToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    test("hashes tokens deterministically", () => {
      const token = "abc123";
      const first = hashSessionToken(token);
      const second = hashSessionToken(token);

      expect(first).toBe(second);
      expect(first).toMatch(/^[0-9a-f]{64}$/);
      expect(first).not.toBe(token);
    });
  });

  describe("secret box", () => {
    test("round-trips a TOTP secret", () => {
      const plaintext = "JBSWY3DPEHPK3PXP";
      const encrypted = encryptSecret(plaintext, TEST_MFA_ENCRYPTION_KEY);
      const decrypted = decryptSecret(encrypted, TEST_MFA_ENCRYPTION_KEY);

      expect(decrypted).toBe(plaintext);
      expect(encrypted.ciphertext).not.toBe(plaintext);
      expect(encrypted.nonce.length).toBeGreaterThan(0);
    });
  });
});
