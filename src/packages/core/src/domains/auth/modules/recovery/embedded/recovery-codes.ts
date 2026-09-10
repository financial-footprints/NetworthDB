import { createHash, randomBytes } from "node:crypto";

export const RECOVERY_CODE_COUNT = 10;

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

export function hashRecoveryCode(code: string): string {
  const normalized = normalizeRecoverySecret(code);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function generateRecoveryCodes(): { plain: string[]; hashes: string[] } {
  const plain: string[] = [];
  const hashes: string[] = [];

  for (let index = 0; index < RECOVERY_CODE_COUNT; index += 1) {
    const raw = randomBytes(16).toString("base64url");
    const code = formatDashedRecoveryCode(raw);
    plain.push(code);
    hashes.push(hashRecoveryCode(code));
  }

  return { plain, hashes };
}
