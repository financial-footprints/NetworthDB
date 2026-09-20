import { describe, expect, test } from "bun:test";
import { flattenCatalogSlots, parseCardCatalog } from "@ndb/platform";
import { catalogStatusLabel } from "@web/components/CreditCards/CatalogStatusChip";
import {
  annualFeeDetailSupplement,
  catalogLegalDisclaimer,
  formatFeeCompactValue,
  formatMatrixPillLabel,
  formatSlotCompactValue,
  resolveSlotSourceUrl,
  shouldOmitTableRow,
} from "@web/utils/credit-cards/display";
import { filterCatalogListItems, shouldHideParserFallback } from "@web/utils/credit-cards/filters";

const minimalCatalog = {
  schema_version: 1,
  registry_key: "test/default",
  bank: "test",
  variant: "default",
  display_name: "Test Card",
  default_kind: "named",
  networks: ["Visa"],
  reward_kind: "unknown",
  researched_at: "2026-09-20",
  updated_at: "2026-09-20",
  sources: [
    {
      url: "https://example.com/mitc",
      retrieved_at: "2026-09-20",
      label: "MITC",
    },
  ],
  tags: [],
  conflicts: [],
  disclaimer: "Summary for convenience.",
  fees: {
    joining: { status: "NA", summary: "NA", confidence: "verified_mitc" },
    annual: { status: "NA", summary: "NA", confidence: "verified_mitc" },
    annual_waiver: { status: "NA", summary: "NA", confidence: "verified_mitc" },
    forex: { status: "NA", summary: "NA", confidence: "verified_mitc" },
    fuel_surcharge: {
      status: "conditional",
      summary: "Fuel surcharge waiver applies on eligible spends.",
      confidence: "verified_mitc",
      conditions: [{ type: "cap", summary: "Waiver is capped each cycle." }],
    },
  },
  rewards: {
    base_earn: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
    accelerated: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
    upi: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
    redemption: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
    expiry: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
  },
  lounge: {
    summary: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
    domestic: { status: "NA", summary: "NA", confidence: "verified_mitc" },
    international: { status: "NA", summary: "NA", confidence: "verified_mitc" },
    railway: { status: "NA", summary: "NA", confidence: "verified_mitc" },
  },
  lifestyle: {
    dining: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
    movies: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
    golf: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
    concierge: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
  },
  insurance: {
    travel: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
    accident: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
    card_protect: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
  },
  milestones: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
  welcome: { status: "yes", summary: "Welcome benefit is offered.", confidence: "verified_mitc" },
};

describe("credit card catalog UI helpers", () => {
  test("renders NA status label for mandatory NA slots", () => {
    expect(catalogStatusLabel("NA")).toBe("NA");
  });

  test("flatten order places welcome last", () => {
    const catalog = parseCardCatalog(minimalCatalog);
    const paths = flattenCatalogSlots(catalog).map((row) => row.path);
    expect(paths[paths.length - 1]).toBe("welcome");
  });

  test("conditional slot carries conditions in catalog data", () => {
    const catalog = parseCardCatalog(minimalCatalog);
    const fuel = flattenCatalogSlots(catalog).find((row) => row.path === "fees.fuel_surcharge");
    expect(fuel?.slot.status).toBe("conditional");
    expect(fuel?.slot.conditions?.[0]?.summary).toContain("capped");
  });

  test("hides parser fallback catalogs unless toggled", () => {
    const item = {
      registry_key: "hdfc/default",
      display_name: "HDFC",
      bank: "hdfc",
      variant: "default",
      default_kind: "parser_fallback" as const,
      reward_kind: "unknown" as const,
      tags: [],
    };
    expect(shouldHideParserFallback(item, false)).toBe(true);
    expect(shouldHideParserFallback(item, true)).toBe(false);
  });

  test("filterCatalogListItems respects search and fallback toggle", () => {
    const items = [
      {
        registry_key: "idfc/wow",
        display_name: "IDFC WOW",
        bank: "idfc",
        variant: "wow",
        default_kind: "named" as const,
        reward_kind: "points" as const,
        tags: ["lounge"],
      },
      {
        registry_key: "idfc/default",
        display_name: "IDFC Default",
        bank: "idfc",
        variant: "default",
        default_kind: "parser_fallback" as const,
        reward_kind: "unknown" as const,
        tags: [],
      },
    ];
    const filtered = filterCatalogListItems(items, { search: "wow", showParserFallback: false });
    expect(filtered.map((row) => row.registry_key)).toEqual(["idfc/wow"]);
  });
});

describe("slot display helpers", () => {
  test("catalogLegalDisclaimer returns fixed legal line", () => {
    expect(catalogLegalDisclaimer()).toBe(
      "This summary is for convenience. The issuer MITC prevails."
    );
  });

  test("shouldOmitTableRow hides annual waiver row", () => {
    expect(shouldOmitTableRow("fees.annual_waiver")).toBe(true);
    expect(shouldOmitTableRow("fees.annual")).toBe(false);
  });

  test("formatFeeCompactValue shows amount tax and waiver asterisk", () => {
    const annual = {
      status: "yes" as const,
      summary: "The renewal fee is ₹500 plus tax.",
      confidence: "verified_product_page" as const,
    };
    const waiver = {
      status: "conditional" as const,
      summary: "Waived on ₹2 lakh spends.",
      confidence: "verified_product_page" as const,
    };
    expect(formatFeeCompactValue(annual, waiver)).toBe("₹500 + tax*");
  });

  test("formatFeeCompactValue uses dash for nil fees", () => {
    const annual = {
      status: "yes" as const,
      summary: "Annual fee is nil for this product.",
      confidence: "verified_mitc" as const,
    };
    expect(formatFeeCompactValue(annual)).toBe("—");
  });

  test("formatMatrixPillLabel uses status words instead of summary excerpts", () => {
    expect(formatMatrixPillLabel("yes", "The official page snippet states 1 point per ₹100.")).toBe(
      "Yes"
    );
    expect(formatMatrixPillLabel("conditional", "Cap")).toBe("Conditional");
    expect(formatMatrixPillLabel("yes", "—")).toBe("—");
    expect(formatMatrixPillLabel("NA", "NA")).toBe("—");
  });

  test("annualFeeDetailSupplement attaches waiver only for annual fee", () => {
    const catalog = parseCardCatalog({
      ...minimalCatalog,
      fees: {
        ...minimalCatalog.fees,
        annual_waiver: {
          status: "conditional",
          summary: "Waived on spend.",
          confidence: "verified_mitc",
        },
      },
    });
    expect(annualFeeDetailSupplement(catalog, "fees.annual")?.supplementalLabel).toBe(
      "Annual fee waiver"
    );
    expect(annualFeeDetailSupplement(catalog, "rewards.base_earn")).toBeUndefined();
  });

  test("formatSlotCompactValue shows Unknown without summary excerpt", () => {
    const catalog = parseCardCatalog(minimalCatalog);
    const row = flattenCatalogSlots(catalog).find((r) => r.path === "rewards.base_earn");
    if (!row) {
      throw new Error("expected rewards.base_earn slot");
    }
    expect(formatSlotCompactValue(row, { catalog })).toBe("Unknown");
  });

  test("resolveSlotSourceUrl prefers mitc_url", () => {
    const catalog = parseCardCatalog({
      ...minimalCatalog,
      mitc_url: "https://example.com/mitc-pdf",
      official_product_url: "https://example.com/product",
    });
    const slot = catalog.fees.joining;
    expect(resolveSlotSourceUrl(catalog, slot)).toBe("https://example.com/mitc-pdf");
  });
});
