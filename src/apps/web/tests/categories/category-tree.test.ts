import { describe, expect, test } from "bun:test";
import { buildCategoryTree } from "@web/routes/categories/_parts/tree";
import type { CategoryApi } from "@web/utils/api/routes/categories/types";

function category(partial: Pick<CategoryApi, "id" | "name" | "parentId">): CategoryApi {
  return {
    ...partial,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const food = category({ id: "food", name: "Food", parentId: null });
const groceries = category({ id: "groceries", name: "Groceries", parentId: "food" });
const dining = category({ id: "dining", name: "Dining", parentId: "food" });
const housing = category({ id: "housing", name: "Housing", parentId: null });
const rent = category({ id: "rent", name: "Rent", parentId: "housing" });

const items = [food, groceries, dining, housing, rent];

describe("buildCategoryTree", () => {
  test("returns every root and its children when search is empty", () => {
    const tree = buildCategoryTree(items, "");
    expect(tree.roots.map((root) => root.id)).toEqual(["food", "housing"]);
    expect(tree.childrenByParent.get("food")?.map((child) => child.id)).toEqual([
      "groceries",
      "dining",
    ]);
    expect(tree.childrenByParent.get("housing")?.map((child) => child.id)).toEqual(["rent"]);
  });

  test("includes the parent when only a subcategory matches", () => {
    const tree = buildCategoryTree(items, "groc");
    expect(tree.roots.map((root) => root.id)).toEqual(["food"]);
    expect(tree.childrenByParent.get("food")?.map((child) => child.id)).toEqual(["groceries"]);
  });

  test("shows all children when the parent name matches", () => {
    const tree = buildCategoryTree(items, "food");
    expect(tree.roots.map((root) => root.id)).toEqual(["food"]);
    expect(tree.childrenByParent.get("food")?.map((child) => child.id)).toEqual([
      "groceries",
      "dining",
    ]);
  });

  test("returns no roots when nothing matches", () => {
    const tree = buildCategoryTree(items, "travel");
    expect(tree.roots).toEqual([]);
    expect(tree.childrenByParent.size).toBe(0);
  });
});
