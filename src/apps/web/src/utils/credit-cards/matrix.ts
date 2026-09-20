import type { CardCatalog, CatalogSlot, SlotStatus } from "@ndb/platform";
import { CATALOG_GROUPS, flattenCatalogSlots } from "@ndb/platform";
import type { CreditCardCatalogListItem } from "@web/utils/api/routes/credit-cards";
import { formatSlotCompactValue, shouldOmitTableRow } from "@web/utils/credit-cards/display";
import { filterCatalogListItems } from "@web/utils/credit-cards/filters";

export const MATRIX_LINK_COLUMN_IDS = ["mitc", "product", "sources"] as const;
export type MatrixLinkColumnId = (typeof MATRIX_LINK_COLUMN_IDS)[number];

export const MATRIX_SECTION_IDS = [
  "rewards",
  "lounge",
  "lifestyle",
  "insurance",
  "milestones",
  "fees",
  "links",
] as const;

export type MatrixSectionId = (typeof MATRIX_SECTION_IDS)[number];

const GROUP_DISPLAY_ORDER: string[] = [
  "rewards",
  "lounge",
  "lifestyle",
  "insurance",
  "milestones",
  "welcome",
  "fees",
  "links",
];

export type MatrixSlotBenefitRow = {
  kind: "slot";
  id: string;
  label: string;
  groupId: string;
  groupLabel: string;
};

export type MatrixLinkBenefitRow = {
  kind: MatrixLinkColumnId;
  id: MatrixLinkColumnId;
  label: string;
  groupId: "links";
  groupLabel: "Links";
};

export type MatrixBenefitRow = MatrixSlotBenefitRow | MatrixLinkBenefitRow;

export type MatrixCell = {
  kind: "slot";
  path: string;
  fieldLabel: string;
  compact: string;
  status: SlotStatus;
  slot: CatalogSlot;
};

export type MatrixRow = {
  catalog: CardCatalog;
  listItem: CreditCardCatalogListItem;
  cells: Record<string, MatrixCell>;
};

function groupLabelForId(groupId: string): string {
  const group = CATALOG_GROUPS.find((entry) => entry.id === groupId);
  return group?.label ?? groupId;
}

function slotRowsForGroup(groupId: string): MatrixSlotBenefitRow[] {
  const group = CATALOG_GROUPS.find((entry) => entry.id === groupId);
  if (!group) {
    return [];
  }
  if (group.kind === "slot") {
    if (shouldOmitTableRow(group.id)) {
      return [];
    }
    return [
      {
        kind: "slot",
        id: group.id,
        label: group.label,
        groupId: group.id,
        groupLabel: group.label,
      },
    ];
  }
  const rows: MatrixSlotBenefitRow[] = [];
  for (const field of group.fields) {
    const path = `${group.id}.${field.id}`;
    if (shouldOmitTableRow(path)) {
      continue;
    }
    rows.push({
      kind: "slot",
      id: path,
      label: field.label,
      groupId: group.id,
      groupLabel: group.label,
    });
  }
  return rows;
}

export function matrixBenefitRows(): MatrixBenefitRow[] {
  const rows: MatrixBenefitRow[] = [];

  for (const groupId of GROUP_DISPLAY_ORDER) {
    if (groupId === "links") {
      rows.push(
        { kind: "mitc", id: "mitc", label: "MITC", groupId: "links", groupLabel: "Links" },
        { kind: "product", id: "product", label: "Product", groupId: "links", groupLabel: "Links" },
        { kind: "sources", id: "sources", label: "Sources", groupId: "links", groupLabel: "Links" }
      );
      continue;
    }
    rows.push(...slotRowsForGroup(groupId));
  }

  return rows;
}

export function benefitRowSectionId(row: MatrixBenefitRow): MatrixSectionId {
  if (row.groupId === "links") {
    return "links";
  }
  if (row.groupId === "welcome" || row.groupId === "milestones") {
    return "milestones";
  }
  return row.groupId as MatrixSectionId;
}

export type VisibleBenefitRowsOptions = {
  excludedSections?: Set<MatrixSectionId>;
};

export function visibleMatrixBenefitRows(
  options: VisibleBenefitRowsOptions = {}
): MatrixBenefitRow[] {
  const excluded = options.excludedSections ?? new Set<MatrixSectionId>();
  if (excluded.size === 0) {
    return matrixBenefitRows();
  }
  return matrixBenefitRows().filter((row) => !excluded.has(benefitRowSectionId(row)));
}

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

export function buildMatrixRows(catalogs: CardCatalog[]): MatrixRow[] {
  return catalogs
    .map((catalog) => {
      const waiverSlot = catalog.fees.annual_waiver;
      const flat = flattenCatalogSlots(catalog);
      const cells: Record<string, MatrixCell> = {};

      for (const row of flat) {
        if (shouldOmitTableRow(row.path)) {
          continue;
        }
        cells[row.path] = {
          kind: "slot",
          path: row.path,
          fieldLabel: row.fieldLabel,
          compact: formatSlotCompactValue(row, { catalog, waiverSlot }),
          status: row.slot.status,
          slot: row.slot,
        };
      }

      return {
        catalog,
        listItem: listItemFromCatalog(catalog),
        cells,
      };
    })
    .sort((a, b) => a.listItem.registry_key.localeCompare(b.listItem.registry_key));
}

export type MatrixFilterOptions = {
  showParserFallback?: boolean;
  excludedBanks?: Set<string>;
};

export function filterMatrixRows(rows: MatrixRow[], options: MatrixFilterOptions): MatrixRow[] {
  const listItems = rows.map((row) => row.listItem);
  const allowedKeys = new Set(
    filterCatalogListItems(listItems, {
      showParserFallback: options.showParserFallback,
    }).map((item) => item.registry_key)
  );

  let filtered = rows.filter((row) => allowedKeys.has(row.listItem.registry_key));

  const excludedBanks = options.excludedBanks;
  if (excludedBanks && excludedBanks.size > 0) {
    filtered = filtered.filter((row) => !excludedBanks.has(row.listItem.bank));
  }

  return filtered;
}

export function sectionLabel(sectionId: MatrixSectionId): string {
  if (sectionId === "milestones") {
    return "Milestones & welcome";
  }
  if (sectionId === "links") {
    return "Links";
  }
  return groupLabelForId(sectionId);
}

export function distinctGroupLabels(rows: MatrixBenefitRow[]): string[] {
  const labels: string[] = [];
  for (const row of rows) {
    if (!labels.includes(row.groupLabel)) {
      labels.push(row.groupLabel);
    }
  }
  return labels;
}
