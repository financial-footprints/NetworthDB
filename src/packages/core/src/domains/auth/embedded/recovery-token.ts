import { normalizeRecoverySecret } from "@core/domains/auth/embedded/recovery-codes";
import type { TokenDigest } from "@core/ports/auth";

export function hashRecoverySecret(tokens: TokenDigest, secret: string): string {
  const normalized = normalizeRecoverySecret(secret);
  return tokens.sha256Hex(normalized);
}

export function generateRecoveryToken(tokens: TokenDigest): string {
  return tokens.randomBase64Url(32);
}
