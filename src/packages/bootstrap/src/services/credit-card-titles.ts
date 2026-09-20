import type { CreditCardTitleLookup } from "@ndb/core";
import { resolveCreditCardCatalogTitle } from "@ndb/platform";
import { loadCardCatalogs } from "@ndb/platform/cards/server";

export function createCreditCardTitleLookup(): CreditCardTitleLookup {
  let titles: Map<string, string> | null = null;
  let pending: Promise<Map<string, string>> | null = null;

  async function load(): Promise<Map<string, string>> {
    if (titles) {
      return titles;
    }
    pending ??= loadCardCatalogs().then((catalogs) => {
      titles = new Map(
        [...catalogs.values()].map((catalog) => [catalog.registry_key, catalog.display_name])
      );
      return titles;
    });
    return pending;
  }

  return {
    async title(bank, variant) {
      const catalogByKey = await load();
      return resolveCreditCardCatalogTitle(bank, variant, catalogByKey);
    },
  };
}
