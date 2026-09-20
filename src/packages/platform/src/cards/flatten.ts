import { CATALOG_GROUPS } from "@platform/cards/groups";
import type { CardCatalog, CatalogSlot } from "@platform/cards/schema";

export type FlattenedCatalogSlot = {
  groupId: string;
  groupLabel: string;
  fieldId: string | null;
  fieldLabel: string;
  path: string;
  slot: CatalogSlot;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function slotFromGroup(group: Record<string, unknown>, fieldId: string): CatalogSlot {
  const slot = group[fieldId];
  if (!isRecord(slot)) {
    throw new Error(`Missing slot "${fieldId}".`);
  }
  return slot as CatalogSlot;
}

export function flattenCatalogSlots(catalog: CardCatalog): FlattenedCatalogSlot[] {
  const rows: FlattenedCatalogSlot[] = [];
  const catalogRecord = catalog as unknown as Record<string, unknown>;

  for (const group of CATALOG_GROUPS) {
    if (group.kind === "slot") {
      rows.push({
        groupId: group.id,
        groupLabel: group.label,
        fieldId: null,
        fieldLabel: group.label,
        path: group.id,
        slot: catalogRecord[group.id] as CatalogSlot,
      });
      continue;
    }

    const groupValue = catalogRecord[group.id];
    if (!isRecord(groupValue)) {
      throw new Error(`Missing catalog group "${group.id}".`);
    }
    for (const field of group.fields) {
      rows.push({
        groupId: group.id,
        groupLabel: group.label,
        fieldId: field.id,
        fieldLabel: field.label,
        path: `${group.id}.${field.id}`,
        slot: slotFromGroup(groupValue, field.id),
      });
    }
  }

  return rows;
}

export function diffCatalogCoverage(
  catalogKeys: Iterable<string>,
  handlerKeys: Iterable<string>,
  waivedKeys: Iterable<string> = []
): { missing: string[]; extra: string[] } {
  const catalogs = new Set(catalogKeys);
  const handlers = new Set(handlerKeys);
  const waived = new Set(waivedKeys);
  const missing = [...handlers].filter((key) => !catalogs.has(key) && !waived.has(key)).sort();
  const extra = [...catalogs].filter((key) => !handlers.has(key) && !waived.has(key)).sort();
  return { missing, extra };
}
