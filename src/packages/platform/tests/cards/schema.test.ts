import { describe, expect, test } from "bun:test";
import { flattenCatalogSlots } from "@platform/cards/flatten";
import { cardCatalogSchema, parseCardCatalog } from "@platform/cards/schema";
import { validCatalog, validCatalogInput } from "@tests/platform/cards/helpers";

describe("cardCatalogSchema", () => {
  test("accepts a complete nested catalog", () => {
    const catalog = validCatalog();
    expect(catalog.registry_key).toBe("idfc/wow");
    expect(catalog.lounge.domestic.status).toBe("unknown");
  });

  test("rejects a missing group field", () => {
    const input = validCatalogInput();
    const lounge = { ...(input.lounge as Record<string, unknown>) };
    delete lounge.international;
    input.lounge = lounge;
    const result = cardCatalogSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  test("rejects NA status with a non-NA summary", () => {
    const input = validCatalogInput();
    const fees = { ...(input.fees as Record<string, unknown>) };
    fees.joining = {
      status: "NA",
      summary: "There is no joining fee.",
      confidence: "verified_mitc",
    };
    input.fees = fees;
    const result = cardCatalogSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  test("rejects NA summary with a non-NA status", () => {
    const input = validCatalogInput();
    const fees = { ...(input.fees as Record<string, unknown>) };
    fees.joining = {
      status: "yes",
      summary: "NA",
      confidence: "verified_mitc",
    };
    input.fees = fees;
    const result = cardCatalogSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  test("rejects registry_key that does not match bank and variant", () => {
    const result = cardCatalogSchema.safeParse(validCatalogInput({ registry_key: "hdfc/swiggy" }));
    expect(result.success).toBe(false);
  });

  test("rejects lowercase na status", () => {
    const input = validCatalogInput();
    const fees = { ...(input.fees as Record<string, unknown>) };
    fees.joining = { status: "na", summary: "NA", confidence: "verified_mitc" };
    input.fees = fees;
    const result = cardCatalogSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("flattenCatalogSlots", () => {
  test("walks groups in display order and puts welcome last", () => {
    const rows = flattenCatalogSlots(validCatalog());
    expect(rows[0]?.path).toBe("fees.joining");
    expect(rows.at(-2)?.path).toBe("milestones");
    expect(rows.at(-1)?.path).toBe("welcome");
    expect(rows.find((row) => row.path === "lounge.summary")?.fieldLabel).toBe("Overview");
  });
});

describe("parseCardCatalog", () => {
  test("returns the parsed catalog", () => {
    expect(parseCardCatalog(validCatalogInput()).display_name).toContain("WOW");
  });
});
