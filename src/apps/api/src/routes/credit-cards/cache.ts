import type { CardCatalog } from "@ndb/platform";
import { loadCardCatalogs } from "@ndb/platform/cards/server";

let cachedCatalogs: Map<string, CardCatalog> | null = null;
let cachedDataDir: string | undefined;

export async function getCreditCardTitleMap(dataDir?: string): Promise<Map<string, string>> {
  const catalogs = await getCardCatalogs(dataDir);
  return new Map(
    [...catalogs.values()].map((catalog) => [catalog.registry_key, catalog.display_name])
  );
}

export async function getCardCatalogs(dataDir?: string): Promise<Map<string, CardCatalog>> {
  if (cachedCatalogs && (dataDir === undefined || dataDir === cachedDataDir)) {
    return cachedCatalogs;
  }
  cachedDataDir = dataDir;
  cachedCatalogs = await loadCardCatalogs(dataDir);
  return cachedCatalogs;
}
