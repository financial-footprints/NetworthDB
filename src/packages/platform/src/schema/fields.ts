import { z } from "zod";

export function requiredTrimmedString(message: string) {
  return z
    .string({
      error: (issue) =>
        issue.input === undefined || typeof issue.input !== "string" ? message : undefined,
    })
    .trim()
    .min(1, { error: message });
}

export function optionalTrimmedString() {
  return z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : undefined))
    .optional();
}

export function optionalNonEmptyString() {
  return z
    .string()
    .transform((value) => (value.length > 0 ? value : undefined))
    .optional();
}
