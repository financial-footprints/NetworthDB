import { parseRupeeToInteger } from "@web/utils/money";

export type AmountFilterMode = "any" | "min" | "max" | "between";

export type LedgerFilters = {
  from?: string;
  to?: string;
  description: string;
  sourceAccountId: string;
  destinationAccountId: string;
  categoryId: string;
  tagId: string;
  amountMode: AmountFilterMode;
  amountMinInput: string;
  amountMaxInput: string;
};

export type LedgerApiFilterParams = {
  from?: string;
  to?: string;
  word?: string;
  categoryId?: string;
  tagId?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  amountMin?: number;
  amountMax?: number;
};

function parseFilterAmount(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    const amount = parseRupeeToInteger(trimmed);
    return amount > 0 ? amount : undefined;
  } catch {
    return undefined;
  }
}

export function ledgerFiltersToApiQuery(filters: LedgerFilters): LedgerApiFilterParams {
  const amountMinParsed = parseFilterAmount(filters.amountMinInput);
  const amountMaxParsed = parseFilterAmount(filters.amountMaxInput);

  let amountMin: number | undefined;
  let amountMax: number | undefined;

  switch (filters.amountMode) {
    case "min":
      amountMin = amountMinParsed;
      break;
    case "max":
      amountMax = amountMaxParsed;
      break;
    case "between":
      amountMin = amountMinParsed;
      amountMax = amountMaxParsed;
      if (amountMin !== undefined && amountMax !== undefined && amountMin > amountMax) {
        amountMin = undefined;
        amountMax = undefined;
      }
      break;
    default:
      break;
  }

  return {
    from: filters.from,
    to: filters.to,
    word: filters.description.trim() || undefined,
    categoryId: filters.categoryId || undefined,
    tagId: filters.tagId || undefined,
    sourceAccountId: filters.sourceAccountId || undefined,
    destinationAccountId: filters.destinationAccountId || undefined,
    amountMin,
    amountMax,
  };
}

export function ledgerFiltersActive(filters: LedgerFilters): boolean {
  if (filters.description.trim()) {
    return true;
  }
  if (filters.sourceAccountId || filters.destinationAccountId) {
    return true;
  }
  if (filters.categoryId || filters.tagId) {
    return true;
  }
  if (filters.amountMode === "any") {
    return false;
  }
  if (filters.amountMode === "min" && filters.amountMinInput.trim()) {
    return true;
  }
  if (filters.amountMode === "max" && filters.amountMaxInput.trim()) {
    return true;
  }
  if (
    filters.amountMode === "between" &&
    (filters.amountMinInput.trim() || filters.amountMaxInput.trim())
  ) {
    return true;
  }
  return false;
}

export function ledgerActiveFilterCount(filters: LedgerFilters): number {
  let count = 0;
  if (filters.description.trim()) {
    count += 1;
  }
  if (filters.sourceAccountId) {
    count += 1;
  }
  if (filters.destinationAccountId) {
    count += 1;
  }
  if (filters.categoryId) {
    count += 1;
  }
  if (filters.tagId) {
    count += 1;
  }
  if (filters.amountMode === "min" && filters.amountMinInput.trim()) {
    count += 1;
  } else if (filters.amountMode === "max" && filters.amountMaxInput.trim()) {
    count += 1;
  } else if (
    filters.amountMode === "between" &&
    (filters.amountMinInput.trim() || filters.amountMaxInput.trim())
  ) {
    count += 1;
  }
  return count;
}

export type PartyPickerOption = {
  id: string;
  label: string;
};
