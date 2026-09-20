import { describe, expect, test } from "bun:test";
import {
  formatRuleWhen,
  parseRuleText,
  type RuleTextCatalogs,
} from "@web/routes/rules/_parts/text";

const catalogs: RuleTextCatalogs = {
  accounts: [
    { id: "hdfc", label: "HDFC" },
    { id: "other", label: "Other" },
  ],
  categories: [
    { id: "food", name: "Food", parentId: null },
    { id: "delivery", name: "Delivery", parentId: "food" },
  ],
  tags: [{ id: "swiggy-tag", name: "Swiggy" }],
};

describe("rule text", () => {
  test("and of description and amount round-trips", () => {
    const text = 'description contains "swiggy"\nand amount > 500';
    const parsed = parseRuleText(text, catalogs);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.when).toEqual({
      op: "and",
      items: [
        { type: "description_contains", value: "swiggy" },
        { type: "amount_greater", amount: 50000 },
      ],
    });
    expect(formatRuleWhen(parsed.when, catalogs)).toBe(text);
  });

  test("and binds tighter than or and format adds parentheses", () => {
    const parsed = parseRuleText(
      'description contains "a" and description contains "b" or description contains "c"',
      catalogs
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.when).toEqual({
      op: "or",
      items: [
        {
          op: "and",
          items: [
            { type: "description_contains", value: "a" },
            { type: "description_contains", value: "b" },
          ],
        },
        { type: "description_contains", value: "c" },
      ],
    });
    expect(formatRuleWhen(parsed.when, catalogs)).toBe(
      '(\n  description contains "a"\n  and description contains "b"\n)\nor description contains "c"'
    );
  });

  test("category path maps to subcategory", () => {
    const parsed = parseRuleText('category is "Food / Delivery"', catalogs);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.when).toEqual({ type: "subcategory_is", subcategoryId: "delivery" });
    expect(formatRuleWhen(parsed.when, catalogs)).toBe('category is "Food / Delivery"');
  });

  test("unknown category names the line", () => {
    const parsed = parseRuleText('category is "Missing"', catalogs);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }
    expect(parsed.error).toContain("Line 1");
  });

  test("duplicate account names fail", () => {
    const parsed = parseRuleText('source account is "HDFC"', {
      ...catalogs,
      accounts: [
        { id: "a", label: "HDFC" },
        { id: "b", label: "hdfc" },
      ],
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }
    expect(parsed.error).toContain('More than one account is named "HDFC"');
  });

  test("fractional rupees round-trip", () => {
    const parsed = parseRuleText("amount > 500.50", catalogs);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.when).toEqual({ type: "amount_greater", amount: 50050 });
    expect(formatRuleWhen(parsed.when, catalogs)).toBe("amount > 500.50");
  });

  test("empty text fails", () => {
    expect(parseRuleText("   ", catalogs).ok).toBe(false);
  });

  test("a fifth nested group fails", () => {
    const text = '(((((\ndescription contains "a"\n)))))';
    const parsed = parseRuleText(text, catalogs);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }
    expect(parsed.error).toContain("4 levels");
  });
});
