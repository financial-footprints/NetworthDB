import { MAX_TAXONOMY_NAME_LEN } from "@core/domains/account/taxonomy/constants";
import { ValidationError } from "@core/shared/errors/domain-error";

export function normalizeTaxonomyName(raw: string): string {
  const name = raw.trim();
  if (!name) {
    throw new ValidationError("Name is invalid.");
  }
  if (name.length > MAX_TAXONOMY_NAME_LEN) {
    throw new ValidationError("Name is invalid.");
  }
  return name;
}
