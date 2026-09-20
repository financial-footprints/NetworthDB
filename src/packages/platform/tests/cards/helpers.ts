import { parseCardCatalog } from "@platform/cards/schema";

const na = {
  status: "NA" as const,
  summary: "NA",
  confidence: "verified_mitc" as const,
};

const unknown = {
  status: "unknown" as const,
  summary: "This benefit is not described in the sources we checked.",
  confidence: "unknown" as const,
};

export function validCatalogInput(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    schema_version: 1,
    registry_key: "idfc/wow",
    bank: "idfc",
    variant: "wow",
    display_name: "IDFC FIRST WOW! Credit Card",
    default_kind: "named",
    networks: ["Visa"],
    reward_kind: "points",
    official_product_url: "https://www.idfcfirstbank.com/credit-card/wow",
    mitc_url: "https://www.idfcfirstbank.com/credit-card/mitc",
    researched_at: "2026-09-20",
    updated_at: "2026-09-20",
    sources: [
      {
        url: "https://www.idfcfirstbank.com/credit-card/wow",
        retrieved_at: "2026-09-20",
        label: "Product page",
      },
    ],
    tags: ["upi", "rewards"],
    conflicts: [],
    disclaimer: "This summary is for convenience. The issuer MITC prevails.",
    fees: {
      joining: na,
      annual: na,
      annual_waiver: na,
      forex: na,
      fuel_surcharge: {
        status: "conditional",
        summary: "A 1% fuel surcharge waiver applies on transactions from ₹200 to ₹5,000.",
        confidence: "verified_mitc",
        conditions: [{ type: "cap", summary: "The waiver is capped at ₹100 per statement cycle." }],
      },
    },
    rewards: {
      base_earn: unknown,
      accelerated: unknown,
      upi: unknown,
      redemption: unknown,
      expiry: unknown,
    },
    lounge: {
      summary: unknown,
      domestic: unknown,
      international: unknown,
      railway: unknown,
    },
    lifestyle: {
      dining: unknown,
      movies: unknown,
      golf: unknown,
      concierge: unknown,
    },
    insurance: {
      travel: unknown,
      accident: unknown,
      card_protect: unknown,
    },
    milestones: unknown,
    welcome: unknown,
    ...overrides,
  };
}

export function validCatalog(overrides: Record<string, unknown> = {}) {
  return parseCardCatalog(validCatalogInput(overrides));
}
