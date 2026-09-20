import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diffCatalogCoverage } from "@platform/cards/flatten";
import { loadCardCatalog, loadCardCatalogs, resolveCardCatalogDir } from "@platform/cards/load";
import { validCatalogInput } from "@tests/platform/cards/helpers";

async function writeCatalog(root: string, bank: string, variant: string, body: unknown) {
  const dir = join(root, bank, variant);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "catalog.json"), `${JSON.stringify(body, null, 2)}\n`);
}

describe("loadCardCatalogs", () => {
  test("indexes catalogs by registry_key", async () => {
    const root = await mkdtemp(join(tmpdir(), "card-catalog-"));
    await writeCatalog(root, "idfc", "wow", validCatalogInput());
    const catalogs = await loadCardCatalogs(root);
    expect(catalogs.size).toBe(1);
    expect(catalogs.get("idfc/wow")?.display_name).toContain("WOW");
  });

  test("rejects registry_key that does not match the folder path", async () => {
    const root = await mkdtemp(join(tmpdir(), "card-catalog-"));
    await writeCatalog(
      root,
      "hdfc",
      "swiggy",
      validCatalogInput({
        registry_key: "hdfc/swiggy",
        bank: "hdfc",
        variant: "swiggy",
      })
    );
    await writeCatalog(
      root,
      "idfc",
      "wow",
      validCatalogInput({
        registry_key: "hdfc/swiggy",
        bank: "hdfc",
        variant: "swiggy",
      })
    );
    await expect(loadCardCatalogs(root)).rejects.toThrow(/folder path is "idfc\/wow"/);
  });

  test("skips underscore-prefixed directories such as _template", async () => {
    const root = await mkdtemp(join(tmpdir(), "card-catalog-"));
    await writeCatalog(root, "idfc", "wow", validCatalogInput());
    await writeCatalog(root, "_template", "default", validCatalogInput());
    const catalogs = await loadCardCatalogs(root);
    expect([...catalogs.keys()]).toEqual(["idfc/wow"]);
  });

  test("reports missing and extra registry keys", () => {
    expect(diffCatalogCoverage(["idfc/wow"], ["idfc/wow", "hdfc/swiggy"], [])).toEqual({
      missing: ["hdfc/swiggy"],
      extra: [],
    });
    expect(diffCatalogCoverage(["idfc/wow", "ghost/card"], ["idfc/wow"], [])).toEqual({
      missing: [],
      extra: ["ghost/card"],
    });
    expect(diffCatalogCoverage(["idfc/wow"], ["idfc/wow", "ghost/card"], ["ghost/card"])).toEqual({
      missing: [],
      extra: [],
    });
  });

  test("loadCardCatalog reads a single variant", async () => {
    const root = await mkdtemp(join(tmpdir(), "card-catalog-"));
    await writeCatalog(root, "idfc", "wow", validCatalogInput());
    const catalog = await loadCardCatalog("idfc", "wow", root);
    expect(catalog.bank).toBe("idfc");
  });

  test("loads the repo credit-card catalogs", async () => {
    const catalogs = await loadCardCatalogs();
    expect(catalogs.size).toBe(27);
    expect(catalogs.get("idfc/wow")?.lounge.domestic.status).toBe("conditional");
    expect(catalogs.get("onecard/default")?.default_kind).toBe("sole_product");
  });
});

describe("resolveCardCatalogDir", () => {
  test("resolves packaged platform data/credit-cards when env is unset", () => {
    const previous = process.env.NDB_DATA_DIR;
    delete process.env.NDB_DATA_DIR;
    try {
      expect(resolveCardCatalogDir()).toMatch(/platform[/\\]data[/\\]credit-cards$/);
    } finally {
      if (previous === undefined) {
        delete process.env.NDB_DATA_DIR;
      } else {
        process.env.NDB_DATA_DIR = previous;
      }
    }
  });
});
