import type { CardCatalog, CatalogSlot } from "@ndb/platform";
import {
  type CreditCardBenefitView,
  type CreditCardCatalogListItem,
  creditCardBenefitSchema,
  creditCardCatalogBulkSchema,
  creditCardCatalogDetailsSchema,
  creditCardCatalogListSchema,
  flattenCatalogSlots,
} from "@ndb/platform";

function listItemFromCatalog(catalog: CardCatalog): CreditCardCatalogListItem {
  return {
    registry_key: catalog.registry_key,
    display_name: catalog.display_name,
    bank: catalog.bank,
    variant: catalog.variant,
    default_kind: catalog.default_kind,
    reward_kind: catalog.reward_kind,
    tags: catalog.tags,
    ...(catalog.official_product_url ? { official_product_url: catalog.official_product_url } : {}),
    ...(catalog.mitc_url ? { mitc_url: catalog.mitc_url } : {}),
  };
}

export function serializeCreditCardCatalogList(catalogs: CardCatalog[]) {
  const items = catalogs
    .map((catalog) => listItemFromCatalog(catalog))
    .sort((a, b) => a.registry_key.localeCompare(b.registry_key));
  return creditCardCatalogListSchema.parse({
    items,
    total: items.length,
  });
}

export function serializeCreditCardCatalog(catalog: CardCatalog) {
  return creditCardCatalogDetailsSchema.parse({ data: catalog });
}

export function serializeCreditCardCatalogBulk(catalogs: CardCatalog[]) {
  const items = [...catalogs].sort((a, b) => a.registry_key.localeCompare(b.registry_key));
  return creditCardCatalogBulkSchema.parse({ data: { items } });
}

function benefitEntryFromCatalog(catalog: CardCatalog, slot: CatalogSlot) {
  return {
    registry_key: catalog.registry_key,
    display_name: catalog.display_name,
    bank: catalog.bank,
    variant: catalog.variant,
    default_kind: catalog.default_kind,
    status: slot.status,
    summary: slot.summary,
    confidence: slot.confidence,
    ...(slot.conditions?.length ? { conditions: slot.conditions } : {}),
    ...(catalog.official_product_url ? { official_product_url: catalog.official_product_url } : {}),
    ...(catalog.mitc_url ? { mitc_url: catalog.mitc_url } : {}),
  };
}

export function serializeCreditCardBenefit(slotId: string, catalogs: CardCatalog[]) {
  const reference = catalogs[0];
  if (!reference) {
    throw new Error("Cannot serialize benefit view without catalogs.");
  }

  const flattened = flattenCatalogSlots(reference);
  const slotRow = flattened.find((row) => row.path === slotId);
  if (!slotRow) {
    throw new Error(`Unknown slot "${slotId}".`);
  }

  const items = catalogs.map((catalog) => {
    const row = flattenCatalogSlots(catalog).find((entry) => entry.path === slotId);
    if (!row) {
      throw new Error(`Catalog "${catalog.registry_key}" is missing slot "${slotId}".`);
    }
    return benefitEntryFromCatalog(catalog, row.slot);
  });

  const view: CreditCardBenefitView = {
    slot_id: slotId,
    group_label: slotRow.groupLabel,
    field_label: slotRow.fieldLabel,
    items: items.sort((a, b) => a.registry_key.localeCompare(b.registry_key)),
  };

  return creditCardBenefitSchema.parse({ data: view });
}
