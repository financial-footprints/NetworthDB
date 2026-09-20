import { omitSensitiveFields } from "@ndb/platform";

type LogLevel = "debug" | "info" | "warn" | "error";

export function sanitize(fields: Record<string, unknown>): Record<string, unknown> {
  return omitSensitiveFields(fields);
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
