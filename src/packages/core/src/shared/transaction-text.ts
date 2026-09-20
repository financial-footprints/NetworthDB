import { ValidationError } from "@core/shared/errors/domain-error";

export const MAX_DESCRIPTION_LEN = 16384;
export const MAX_REF_NO_LEN = 4096;

export function assertTransactionText(
  value: string,
  field: string,
  maxLen: number,
  allowEmpty: boolean
): void {
  const trimmed = value.trim();
  if (!trimmed) {
    if (allowEmpty) {
      return;
    }
    throw new ValidationError("Text is required.", { field });
  }
  if (trimmed.length > maxLen) {
    throw new ValidationError("Text is too long.", { field });
  }
}
