import { describe, expect, test } from "bun:test";
import { parseCardCatalog } from "@ndb/platform";
import {
  buildMatrixRows,
  filterMatrixRows,
  matrixBenefitRows,
  visibleMatrixBenefitRows,
} from "@web/utils/credit-cards/matrix";

const sampleCatalog = parseCardCatalog({
  schema_version: 1,
  registry_key: "test/alpha",
  bank: "test",
  variant: "alpha",
  display_name: "Test Alpha",
  default_kind: "named",
  networks: ["Visa"],
  reward_kind: "points",
  researched_at: "2026-09-20",
  updated_at: "2026-09-20",
  sources: [{ url: "https://example.com/mitc", retrieved_at: "2026-09-20", label: "MITC" }],
  tags: [],
  conflicts: [],
  disclaimer: "Summary.",
  fees: {
    joining: { status: "NA", summary: "NA", confidence: "verified_mitc" },
    annual: { status: "yes", summary: "The annual fee is ₹500.", confidence: "verified_mitc" },
    annual_waiver: {
      status: "conditional",
      summary: "Waived on spend.",
      confidence: "verified_mitc",
    },
    forex: { status: "NA", summary: "NA", confidence: "verified_mitc" },
    fuel_surcharge: { status: "NA", summary: "NA", confidence: "verified_mitc" },
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
    domestic: { status: "yes", summary: "Domestic lounge offered.", confidence: "verified_mitc" },
    international: { status: "NA", summary: "NA", confidence: "verified_mitc" },
    railway: { status: "NA", summary: "NA", confidence: "verified_mitc" },
  },
  lifestyle: {
    dining: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
    movies: { status: "yes", summary: "Movies benefit.", confidence: "verified_mitc" },
    golf: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
    concierge: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
  },
  insurance: {
    travel: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
    accident: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
    card_protect: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
  },
  milestones: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
  welcome: { status: "NA", summary: "NA", confidence: "verified_mitc" },
});

const sampleBeta = parseCardCatalog({
  schema_version: 1,
  registry_key: "other/beta",
  bank: "other",
  variant: "beta",
  display_name: "Test Beta",
  default_kind: "named",
  networks: ["Visa"],
  reward_kind: "points",
  researched_at: "2026-09-20",
  updated_at: "2026-09-20",
  sources: [{ url: "https://example.com/mitc", retrieved_at: "2026-09-20", label: "MITC" }],
  tags: [],
  conflicts: [],
  disclaimer: "Summary.",
  fees: {
    joining: { status: "NA", summary: "NA", confidence: "verified_mitc" },
    annual: { status: "yes", summary: "The annual fee is ₹500.", confidence: "verified_mitc" },
    annual_waiver: { status: "NA", summary: "NA", confidence: "verified_mitc" },
    forex: { status: "NA", summary: "NA", confidence: "verified_mitc" },
    fuel_surcharge: { status: "NA", summary: "NA", confidence: "verified_mitc" },
  },
  rewards: sampleCatalog.rewards,
  lounge: {
    summary: { status: "unknown", summary: "Unknown.", confidence: "unknown" },
    domestic: { status: "NA", summary: "NA", confidence: "verified_mitc" },
    international: { status: "NA", summary: "NA", confidence: "verified_mitc" },
    railway: { status: "NA", summary: "NA", confidence: "verified_mitc" },
  },
  lifestyle: sampleCatalog.lifestyle,
  insurance: sampleCatalog.insurance,
  milestones: sampleCatalog.milestones,
  welcome: sampleCatalog.welcome,
});

describe("catalog matrix", () => {
  test("matrixBenefitRows puts rewards before fees and links last", () => {
    const ids = matrixBenefitRows().map((row) => row.id);
    const rewardsIdx = ids.indexOf("rewards.base_earn");
    const feesIdx = ids.indexOf("fees.joining");
    const mitcIdx = ids.indexOf("mitc");
    expect(rewardsIdx).toBeGreaterThanOrEqual(0);
    expect(feesIdx).toBeGreaterThan(rewardsIdx);
    expect(mitcIdx).toBeGreaterThan(feesIdx);
    expect(ids).not.toContain("fees.annual_waiver");
  });

  test("buildMatrixRows includes waiver asterisk on annual fee", () => {
    const rows = buildMatrixRows([sampleCatalog]);
    expect(rows[0]?.cells["fees.annual"]?.compact).toBe("₹500*");
  });

  test("visibleMatrixBenefitRows excludes rewards section only", () => {
    const visible = visibleMatrixBenefitRows({ excludedSections: new Set(["rewards"]) });
    expect(visible.some((row) => row.id.startsWith("rewards."))).toBe(false);
    expect(visible.some((row) => row.id.startsWith("lounge."))).toBe(true);
  });

  test("filterMatrixRows excludes bank columns", () => {
    const rows = buildMatrixRows([sampleCatalog, sampleBeta]);
    const filtered = filterMatrixRows(rows, { excludedBanks: new Set(["test"]) });
    expect(filtered.map((row) => row.listItem.registry_key)).toEqual(["other/beta"]);
  });
});
