import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type CardCatalog, parseCardCatalog } from "@platform/cards/schema";

/** Default tree shipped with `@ndb/platform` (`data/credit-cards` next to `src/`). */
export function packageCardCatalogDataDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "../../data/credit-cards");
}

export function resolveCardCatalogDir(fromDir = process.cwd()): string {
  const envDir = process.env.NDB_DATA_DIR?.trim();
  if (envDir) {
    const nested = join(envDir, "credit-cards");
    if (existsSync(nested)) {
      return nested;
    }
    if (existsSync(envDir)) {
      return envDir;
    }
  }

  const packaged = packageCardCatalogDataDir();
  if (existsSync(packaged)) {
    return packaged;
  }

  let current = resolve(fromDir);
  for (;;) {
    const catalogs = join(current, "data", "credit-cards");
    if (existsSync(catalogs)) {
      return catalogs;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(
    "Could not locate credit card catalogs under src/packages/platform/data/credit-cards. Set NDB_DATA_DIR to override."
  );
}

async function readCatalogFile(path: string, bank: string, variant: string): Promise<CardCatalog> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid catalog JSON at ${path}: ${message}`);
  }

  let catalog: CardCatalog;
  try {
    catalog = parseCardCatalog(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid catalog at ${path}: ${message}`);
  }

  const expectedKey = `${bank}/${variant}`;
  if (catalog.registry_key !== expectedKey) {
    throw new Error(
      `Catalog at ${path} has registry_key "${catalog.registry_key}" but folder path is "${expectedKey}".`
    );
  }
  if (catalog.bank !== bank || catalog.variant !== variant) {
    throw new Error(
      `Catalog at ${path} has bank/variant "${catalog.bank}/${catalog.variant}" but folder path is "${expectedKey}".`
    );
  }

  return catalog;
}

export async function loadCardCatalogs(dataDir?: string): Promise<Map<string, CardCatalog>> {
  const root = dataDir ?? resolveCardCatalogDir();
  const catalogs = new Map<string, CardCatalog>();
  const bankEntries = await readdir(root, { withFileTypes: true });

  for (const bankEntry of bankEntries) {
    if (!bankEntry.isDirectory() || bankEntry.name.startsWith("_")) {
      continue;
    }
    const bankPath = join(root, bankEntry.name);
    const variantEntries = await readdir(bankPath, { withFileTypes: true });
    for (const variantEntry of variantEntries) {
      if (!variantEntry.isDirectory() || variantEntry.name.startsWith("_")) {
        continue;
      }
      const catalogPath = join(bankPath, variantEntry.name, "catalog.json");
      if (!existsSync(catalogPath)) {
        throw new Error(`Missing catalog.json at ${catalogPath}`);
      }
      const catalog = await readCatalogFile(catalogPath, bankEntry.name, variantEntry.name);
      catalogs.set(catalog.registry_key, catalog);
    }
  }

  return catalogs;
}

export async function loadCardCatalog(
  bank: string,
  variant: string,
  dataDir?: string
): Promise<CardCatalog> {
  const root = dataDir ?? resolveCardCatalogDir();
  const catalogPath = join(root, bank, variant, "catalog.json");
  if (!existsSync(catalogPath)) {
    throw new Error(`Missing catalog.json at ${catalogPath}`);
  }
  return readCatalogFile(catalogPath, bank, variant);
}
