import type { CardCatalog, CatalogSlot, FlattenedCatalogSlot, SlotStatus } from "@ndb/platform";
import { catalogStatusLabel } from "@web/components/CreditCards/CatalogStatusChip";

export const CATALOG_EM_DASH = "—";
export const CATALOG_UNKNOWN_LABEL = "Unknown";

const LEGAL_DISCLAIMER = "This summary is for convenience. The issuer MITC prevails.";

const COMPACT_SUMMARY_MAX = 72;

const FEE_NIL_PATTERN = /\b(nil|zero|no\s+(?:joining|annual|renewal)\s+fee|lifetime\s+free|lft)\b/i;

const RUPEE_PATTERN = /₹[\d,]+(?:\.\d+)?/;

const OFFERED_STATUSES: readonly SlotStatus[] = ["yes", "conditional", "depends"];

export function catalogLegalDisclaimer(): string {
  return LEGAL_DISCLAIMER;
}

export function formatMatrixPillLabel(status: SlotStatus, compact: string): string {
  if (status === "NA" || compact === CATALOG_EM_DASH) {
    return CATALOG_EM_DASH;
  }
  return catalogStatusLabel(status);
}

export function annualFeeDetailSupplement(
  catalog: CardCatalog,
  path: string
): { supplementalLabel: string; supplementalSlot: CatalogSlot } | undefined {
  if (path !== "fees.annual" || catalog.fees.annual_waiver.status === "NA") {
    return undefined;
  }
  return {
    supplementalLabel: "Annual fee waiver",
    supplementalSlot: catalog.fees.annual_waiver,
  };
}

export function shouldOmitTableRow(path: string): boolean {
  return path === "fees.annual_waiver";
}

function isOfferedForWaiver(status: SlotStatus): boolean {
  return (OFFERED_STATUSES as readonly string[]).includes(status);
}

function firstRupeeAmount(summary: string): string | null {
  const match = summary.match(RUPEE_PATTERN);
  return match?.[0] ?? null;
}

function summaryMentionsTax(summary: string): boolean {
  return /\bplus\s+tax\b/i.test(summary) || /\bexclusive\s+of\s+gst\b/i.test(summary);
}

function isNilOrFreeFee(summary: string): boolean {
  if (FEE_NIL_PATTERN.test(summary)) {
    return true;
  }
  const amount = firstRupeeAmount(summary);
  if (amount === "₹0") {
    return true;
  }
  return false;
}

export function hasAnnualWaiverIndicator(waiverSlot: CatalogSlot | undefined): boolean {
  if (!waiverSlot || waiverSlot.status === "NA") {
    return false;
  }
  return isOfferedForWaiver(waiverSlot.status);
}

export function formatFeeCompactValue(feeSlot: CatalogSlot, waiverSlot?: CatalogSlot): string {
  if (feeSlot.status === "NA") {
    return CATALOG_EM_DASH;
  }
  if (feeSlot.status === "unknown") {
    return CATALOG_UNKNOWN_LABEL;
  }

  const asterisk = hasAnnualWaiverIndicator(waiverSlot) ? "*" : "";

  if (isNilOrFreeFee(feeSlot.summary)) {
    return CATALOG_EM_DASH;
  }

  const amount = firstRupeeAmount(feeSlot.summary);
  if (amount) {
    const taxSuffix = summaryMentionsTax(feeSlot.summary) ? " + tax" : "";
    return `${amount}${taxSuffix}${asterisk}`;
  }

  return shortenSummary(feeSlot.summary);
}

function firstSentence(summary: string): string {
  const trimmed = summary.trim();
  const match = trimmed.match(/^[^.!?]+[.!?]?/);
  return (match?.[0] ?? trimmed).trim();
}

function shortenSummary(summary: string): string {
  const sentence = firstSentence(summary);
  if (sentence.length <= COMPACT_SUMMARY_MAX) {
    return sentence;
  }
  return `${sentence.slice(0, COMPACT_SUMMARY_MAX - 1).trimEnd()}…`;
}

export type SlotDisplayContext = {
  catalog: CardCatalog;
  waiverSlot?: CatalogSlot;
};

export function formatSlotCompactValue(
  row: FlattenedCatalogSlot,
  context: SlotDisplayContext
): string {
  const { slot } = row;

  if (slot.status === "NA") {
    return CATALOG_EM_DASH;
  }
  if (slot.status === "unknown") {
    return CATALOG_UNKNOWN_LABEL;
  }

  if (row.path === "fees.joining" || row.path === "fees.annual") {
    const waiver =
      row.path === "fees.annual"
        ? (context.waiverSlot ?? context.catalog.fees.annual_waiver)
        : undefined;
    return formatFeeCompactValue(slot, waiver);
  }

  if (row.path === "fees.forex" || row.path === "fees.fuel_surcharge") {
    const amount = firstRupeeAmount(slot.summary);
    if (amount && row.path === "fees.forex") {
      return amount;
    }
  }

  return shortenSummary(slot.summary);
}

export function resolveSlotSourceUrl(catalog: CardCatalog, slot: CatalogSlot): string | null {
  if (catalog.mitc_url) {
    return catalog.mitc_url;
  }

  const mitcSource = catalog.sources.find((source) => /mitc/i.test(source.label));
  if (mitcSource) {
    return mitcSource.url;
  }

  if (slot.confidence === "verified_product_page" && catalog.official_product_url) {
    return catalog.official_product_url;
  }

  if (catalog.official_product_url) {
    return catalog.official_product_url;
  }

  return catalog.sources[0]?.url ?? null;
}

export function dedupeCatalogSources(
  catalog: CardCatalog
): Array<{ url: string; label: string; retrieved_at: string }> {
  const seen = new Set<string>();
  const result: Array<{ url: string; label: string; retrieved_at: string }> = [];

  for (const source of catalog.sources) {
    if (seen.has(source.url)) {
      continue;
    }
    seen.add(source.url);
    result.push(source);
  }

  return result;
}
