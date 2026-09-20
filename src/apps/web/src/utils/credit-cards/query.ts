import { path } from "@web/router/path";
import type { MatrixSectionId } from "@web/utils/credit-cards/matrix";
import { MATRIX_SECTION_IDS } from "@web/utils/credit-cards/matrix";

export type CreditCardsHubQuery = {
  card?: string;
  excludeSections?: MatrixSectionId[];
  excludeBanks?: string[];
  parserFallback?: boolean;
};

function serializeList(values: readonly string[] | undefined): string | undefined {
  if (!values?.length) {
    return undefined;
  }
  return [...values].sort().join(",");
}

function parseExcludedSections(value: string | null): MatrixSectionId[] {
  if (!value?.trim()) {
    return [];
  }
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is MatrixSectionId =>
      (MATRIX_SECTION_IDS as readonly string[]).includes(part)
    );
}

function parseExcludedBanks(value: string | null): string[] {
  if (!value?.trim()) {
    return [];
  }
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function excludedSectionsSet(query: CreditCardsHubQuery): Set<MatrixSectionId> {
  return new Set(query.excludeSections ?? []);
}

export function excludedBanksSet(query: CreditCardsHubQuery): Set<string> {
  return new Set(query.excludeBanks ?? []);
}

export function creditCardsHubPath(query?: CreditCardsHubQuery): string {
  const params = new URLSearchParams();
  if (query?.card) {
    params.set("card", query.card);
  }
  const sections = serializeList(query?.excludeSections);
  if (sections) {
    params.set("excludeSections", sections);
  }
  const banks = serializeList(query?.excludeBanks);
  if (banks) {
    params.set("excludeBanks", banks);
  }
  if (query?.parserFallback) {
    params.set("parserFallback", "1");
  }
  const serialized = params.toString();
  return serialized ? `${path.creditCards.hub}?${serialized}` : path.creditCards.hub;
}

export function parseCreditCardsHubQuery(params: URLSearchParams): CreditCardsHubQuery {
  const card = params.get("card")?.trim();
  const excludeSections = parseExcludedSections(params.get("excludeSections"));
  const excludeBanks = parseExcludedBanks(params.get("excludeBanks"));
  const parserFallback = params.get("parserFallback") === "1";
  return {
    ...(card ? { card } : {}),
    ...(excludeSections.length > 0 ? { excludeSections } : {}),
    ...(excludeBanks.length > 0 ? { excludeBanks } : {}),
    ...(parserFallback ? { parserFallback: true } : {}),
  };
}

/** Benefit row anchor (pivoted layout). */
export function matrixRowAnchorId(benefitPath: string): string {
  return `matrix-row-${benefitPath.replace(/\./g, "-")}`;
}

/** Card column anchor (pivoted layout). */
export function matrixColumnAnchorId(registryKey: string): string {
  return `matrix-col-${registryKey.replace(/\//g, "-")}`;
}

export function toggleInList<T extends string>(list: readonly T[] | undefined, id: T): T[] {
  const set = new Set(list ?? []);
  if (set.has(id)) {
    set.delete(id);
  } else {
    set.add(id);
  }
  return [...set].sort();
}

/** Flip visibility: ids that were visible become excluded and vice versa. */
export function invertExcluded<T extends string>(
  allIds: readonly T[],
  excluded: ReadonlySet<T>
): T[] {
  const next = allIds.filter((id) => !excluded.has(id));
  return next.length > 0 ? [...next].sort() : [];
}
