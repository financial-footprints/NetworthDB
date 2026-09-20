export const REDACTED = "[REDACTED]";

export const SENSITIVE_FIELD_KEYS = new Set([
  "password",
  "password_hash",
  "token",
  "access_token",
  "refresh_token",
  "session_token",
  "mfa_token",
  "multifactor_token",
  "recovery_code",
  "code",
  "secret",
  "totp_secret",
  "authorization",
  "cookie",
  "smtp_password",
  "postgres_password",
  "email",
  "recovery_email",
  "recipient",
  "to",
  "from",
  "body",
  "subject",
  "account_number",
  "account_label",
  "opening",
  "closing",
  "text_contains",
  "validationdetails",
]);

const NORMALIZED_SENSITIVE_FIELD_KEYS = new Set(
  [...SENSITIVE_FIELD_KEYS].map((key) => normalizeSensitiveFieldKey(key))
);

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function normalizeSensitiveFieldKey(key: string): string {
  let value = key.toLowerCase().trim();
  for (const prefix of ["req_", "user_"]) {
    if (value.startsWith(prefix)) {
      value = value.slice(prefix.length);
    }
  }
  return value.replaceAll(/[_-]/g, "");
}

function redactEmailsInString(value: string): string {
  return value.replace(EMAIL_PATTERN, REDACTED);
}

function shouldOmitString(value: string): boolean {
  if (value.includes("@") && EMAIL_PATTERN.test(value)) {
    return true;
  }
  if (value.includes("://") && value.includes("@")) {
    return true;
  }
  if (value.startsWith("eyJ")) {
    return true;
  }
  return value.toLowerCase().startsWith("bearer ");
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactEmailsInString(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value && typeof value === "object") {
    return redactObject(value as Record<string, unknown>);
  }
  return value;
}

export function redactObject(context: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (NORMALIZED_SENSITIVE_FIELD_KEYS.has(normalizeSensitiveFieldKey(key))) {
      result[key] = REDACTED;
      continue;
    }
    result[key] = redactValue(value);
  }
  return result;
}

export function omitSensitiveFields(context: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_FIELD_KEYS.has(key.toLowerCase())) {
      continue;
    }
    if (typeof value === "string" && shouldOmitString(value)) {
      continue;
    }
    result[key] = value;
  }
  return result;
}
