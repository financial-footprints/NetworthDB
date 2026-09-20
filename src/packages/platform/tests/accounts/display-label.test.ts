import { describe, expect, test } from "bun:test";
import {
  accountRegistryKey,
  formatInstrumentAccountPickerLabel,
  resolveCreditCardCatalogTitle,
} from "@platform/accounts/display-label";

const catalogs = new Map<string, string>([
  ["bob/easy", "Easy Shopping"],
  ["bob/default", "BOB Credit Card"],
  ["hdfc/swiggy", "Swiggy"],
]);

describe("account display labels", () => {
  test("builds a lowercase registry key and treats blank variant as default", () => {
    expect(accountRegistryKey("BOB", "Easy")).toBe("bob/easy");
    expect(accountRegistryKey("bob", null)).toBe("bob/default");
    expect(accountRegistryKey("bob", "default")).toBe("bob/default");
  });

  test("resolves a catalog title and falls back to the bank default", () => {
    expect(resolveCreditCardCatalogTitle("bob", "easy", catalogs)).toBe("Easy Shopping");
    expect(resolveCreditCardCatalogTitle("bob", "missing", catalogs)).toBe("BOB Credit Card");
    expect(resolveCreditCardCatalogTitle("yes", "ace", catalogs)).toBeNull();
  });

  test("formats mixed pickers as type prefix plus title", () => {
    expect(
      formatInstrumentAccountPickerLabel(
        { accountType: "credit_card", label: "bob (easy)", bank: "bob", variant: "easy" },
        catalogs
      )
    ).toBe("Credit Card - Easy Shopping");
    expect(
      formatInstrumentAccountPickerLabel({
        accountType: "bank",
        label: "HDFC (Savings)",
        bank: "hdfc",
        variant: "savings",
      })
    ).toBe("Bank - HDFC (Savings)");
    expect(
      formatInstrumentAccountPickerLabel({
        accountType: "unknown",
        label: "Unknown",
      })
    ).toBe("Unknown");
  });
});
