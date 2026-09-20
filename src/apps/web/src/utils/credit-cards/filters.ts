import type { CreditCardCatalogListItem } from "@web/utils/api/routes/credit-cards";

export function shouldHideParserFallback(
  item: CreditCardCatalogListItem,
  showParserFallback: boolean
): boolean {
  if (showParserFallback) {
    return false;
  }
  return item.default_kind === "parser_fallback";
}

export function filterCatalogListItems(
  items: CreditCardCatalogListItem[],
  options: {
    search?: string;
    bank?: string;
    showParserFallback?: boolean;
  }
): CreditCardCatalogListItem[] {
  const search = options.search?.trim().toLowerCase() ?? "";
  const bank = options.bank?.trim() ?? "";

  return items.filter((item) => {
    if (shouldHideParserFallback(item, options.showParserFallback ?? false)) {
      return false;
    }
    if (bank && item.bank !== bank) {
      return false;
    }
    if (!search) {
      return true;
    }
    const haystack = [item.display_name, item.bank, item.variant, item.registry_key, ...item.tags]
      .join(" ")
      .toLowerCase();
    return haystack.includes(search);
  });
}

export function uniqueBanks(items: CreditCardCatalogListItem[]): string[] {
  const banks = new Set(items.map((item) => item.bank));
  return [...banks].sort();
}
