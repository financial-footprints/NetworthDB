import { describe, expect, test } from "bun:test";
import { loadCardCatalogs } from "@platform/cards/load";
import { APPROVED_CATALOG_DISPLAY_NAMES } from "@tests/platform/cards/approved-display-names";

const RENAME_HINT =
  "If renaming is intentional, update catalog.json and approved-display-names.ts in the same change.";

describe("approved catalog display_name", () => {
  test("loaded catalogs match the manually approved display names", async () => {
    const catalogs = await loadCardCatalogs();
    const approvedKeys = Object.keys(APPROVED_CATALOG_DISPLAY_NAMES).sort();
    const loadedKeys = [...catalogs.keys()].sort();

    expect(loadedKeys).toEqual(approvedKeys);

    for (const [registryKey, catalog] of catalogs) {
      const approved = APPROVED_CATALOG_DISPLAY_NAMES[registryKey];
      expect(approved, `missing approval for ${registryKey}`).toBeDefined();
      expect(catalog.display_name, `${registryKey}: ${RENAME_HINT}`).toBe(approved);
    }
  });
});
