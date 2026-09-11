import { ValidationError } from "@core/shared/errors/domain-error";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoDate(value: string, field: string): string {
  const trimmed = value.trim();
  if (!ISO_DATE_PATTERN.test(trimmed)) {
    throw new ValidationError("core.account.date.invalid.format", { field, value: trimmed });
  }

  return trimmed;
}
