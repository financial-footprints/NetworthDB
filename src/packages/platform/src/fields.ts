import { z } from "zod";

export function requiredTrimmedString(message: string) {
  return z
    .string({ required_error: message, invalid_type_error: message })
    .trim()
    .min(1, { message });
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
