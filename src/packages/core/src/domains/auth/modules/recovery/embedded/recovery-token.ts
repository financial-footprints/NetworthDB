import { createHash, randomBytes } from "node:crypto";
import { normalizeRecoverySecret } from "@core/domains/auth/modules/recovery/embedded/recovery-codes";
import { ValidationError } from "@core/shared/errors/domain-error";

export const RECOVERY_KIND_PASSWORD_RESET = "password_reset";
export const RECOVERY_KIND_ADVANCED = "advanced";

export function hashRecoverySecret(secret: string): string {
  const normalized = normalizeRecoverySecret(secret);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function generateRecoveryToken(): string {
  return randomBytes(32).toString("base64url");
}

export function validateRecoveryEmail(email: string): void {
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("core.auth.recovery.email.invalid.required", { field: "email" });
  }

  if (trimmed.length > 254) {
    throw new ValidationError("core.auth.recovery.email.invalid.too-long", { field: "email" });
  }

  const at = trimmed.indexOf("@");
  if (at <= 0 || at === trimmed.length - 1 || trimmed.includes(" ")) {
    throw new ValidationError("core.auth.recovery.email.invalid.format", { field: "email" });
  }

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (local.length === 0 || domain.length === 0 || !domain.includes(".")) {
    throw new ValidationError("core.auth.recovery.email.invalid.format", { field: "email" });
  }
}
