export const MAX_TAXONOMY_NAME_LEN = 64;
export const MAX_TAGS_PER_TRANSACTION = 20;

export const DEFAULT_CATEGORY_TREE: { name: string; children: string[] }[] = [
  { name: "Food", children: ["Groceries", "Dining"] },
  { name: "Transport", children: ["Fuel", "Transit"] },
  { name: "Housing", children: ["Rent", "Utilities"] },
  { name: "Income", children: ["Salary"] },
  { name: "Health", children: [] },
  { name: "Shopping", children: [] },
  { name: "Transfers", children: [] },
  { name: "Other", children: [] },
];
