import type { CategoryApi } from "@web/utils/api/routes/categories/types";

export type CategoryTree = {
  roots: CategoryApi[];
  childrenByParent: Map<string, CategoryApi[]>;
};

function nameMatches(name: string, query: string): boolean {
  return name.toLowerCase().includes(query);
}

function childrenOf(items: CategoryApi[], parentId: string): CategoryApi[] {
  return items.filter((item) => item.parentId === parentId);
}

export function buildCategoryTree(items: CategoryApi[], search: string): CategoryTree {
  const query = search.trim().toLowerCase();
  const roots = items.filter((item) => item.parentId === null);
  const childrenByParent = new Map<string, CategoryApi[]>();

  if (!query) {
    for (const root of roots) {
      childrenByParent.set(root.id, childrenOf(items, root.id));
    }
    return { roots, childrenByParent };
  }

  const visibleRoots: CategoryApi[] = [];
  for (const root of roots) {
    const children = childrenOf(items, root.id);
    const parentMatches = nameMatches(root.name, query);
    const visibleChildren = parentMatches
      ? children
      : children.filter((child) => nameMatches(child.name, query));
    if (!parentMatches && visibleChildren.length === 0) {
      continue;
    }
    visibleRoots.push(root);
    childrenByParent.set(root.id, visibleChildren);
  }

  return { roots: visibleRoots, childrenByParent };
}
