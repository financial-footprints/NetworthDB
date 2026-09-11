import { RECOVERY_CODE_COUNT } from "@core/domains/auth/constants";
import type { TokenDigest } from "@core/ports/auth";

export function normalizeRecoverySecret(secret: string): string {
  return secret.trim().toUpperCase().replaceAll("-", "").replace(/\s+/g, "");
}

export function formatDashedRecoveryCode(raw: string): string {
  const normalized = raw.trim().replace(/=+$/g, "").toUpperCase();
  if (normalized.length < 16) {
    return normalized;
  }

  return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}`;
}

export function hashRecoveryCode(tokens: TokenDigest, code: string): string {
  const normalized = normalizeRecoverySecret(code);
  return tokens.sha256Hex(normalized);
}

export function generateRecoveryCodes(tokens: TokenDigest): { plain: string[]; hashes: string[] } {
  const plain: string[] = [];
  const hashes: string[] = [];

  for (let index = 0; index < RECOVERY_CODE_COUNT; index += 1) {
    const raw = tokens.randomBase64Url(16);
    const code = formatDashedRecoveryCode(raw);
    plain.push(code);
    hashes.push(hashRecoveryCode(tokens, code));
  }

  return { plain, hashes };
}
