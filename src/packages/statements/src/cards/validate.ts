import { diffCatalogCoverage, flattenCatalogSlots } from "@ndb/platform";
import {
  loadCardCatalogs,
  readRegistryWaivers,
  resolveCardCatalogDir,
} from "@ndb/platform/cards/server";
import { handlerRegistryKey, listHandlers } from "@statements/banks/handlers/registry";

function handlerKeys(): string[] {
  return listHandlers().map(({ bank, variant }) => handlerRegistryKey(bank, variant));
}

/** Ensures platform catalogs match statement handler keys (plus waiver and quality warnings). */
export async function validateCardCatalogs(): Promise<string[]> {
  const dataDir = resolveCardCatalogDir();
  const catalogs = await loadCardCatalogs(dataDir);
  const { keys: waived, expired } = await readRegistryWaivers(dataDir);
  const { missing, extra } = diffCatalogCoverage(catalogs.keys(), handlerKeys(), waived);
  const errors: string[] = [];

  for (const waiver of expired) {
    console.warn(
      `Warning: waiver for ${waiver.key} passed review_by ${waiver.review_by}. Renew or add catalog.json.`
    );
  }

  if (missing.length > 0) {
    errors.push(`Missing catalog.json for handler keys: ${missing.join(", ")}`);
  }
  if (extra.length > 0) {
    errors.push(`Catalogs without handler keys: ${extra.join(", ")}`);
  }

  for (const catalog of catalogs.values()) {
    if (catalog.default_kind !== "parser_fallback") {
      continue;
    }
    const yesLounge = flattenCatalogSlots(catalog).filter(
      (row) => row.groupId === "lounge" && row.slot.status === "yes"
    );
    if (yesLounge.length > 0) {
      const paths = yesLounge.map((row) => row.path).join(", ");
      console.warn(
        `Warning: parser fallback ${catalog.registry_key} sets lounge status "yes" (${paths}).`
      );
    }
  }

  return errors;
}

const isMain = import.meta.main;
if (isMain) {
  const errors = await validateCardCatalogs();
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error);
    }
    process.exit(1);
  }
  console.log("Card catalogs match listHandlers() and the Zod schema.");
}
