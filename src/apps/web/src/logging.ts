type LogLevel = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEYS = new Set([
  "password",
  "password_hash",
  "token",
  "access_token",
  "session_token",
  "refresh_token",
  "mfa_token",
  "multifactor_token",
  "recovery_code",
  "code",
  "secret",
  "totp_secret",
  "authorization",
  "cookie",
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

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

function shouldRedactString(value: string): boolean {
  if (value.includes("@") && EMAIL_PATTERN.test(value)) {
    return true;
  }
  if (value.includes("://") && value.includes("@")) {
    return true;
  }
  if (value.startsWith("eyJ")) {
    return true;
  }
  if (value.toLowerCase().startsWith("bearer ")) {
    return true;
  }
  return false;
}

export function sanitize(fields: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      continue;
    }
    if (typeof value === "string" && shouldRedactString(value)) {
      continue;
    }
    payload[key] = value;
  }
  return payload;
}

export function log(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
  if (import.meta.env.PROD && (level === "debug" || level === "info")) {
    return;
  }
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: "networthdb",
    message,
    ...sanitize(fields ?? {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.debug(line);
  }
}
