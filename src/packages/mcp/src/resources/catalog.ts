import type { CatalogAccess } from "@mcp/helpers";

export type ResourceCatalogEntry = {
  name: string;
  uri?: string;
  uriTemplate?: string;
  access: CatalogAccess;
  title: string;
  description: string;
  mimeType: "application/json" | "text/markdown";
};

export const RESOURCE_CATALOG_ENTRIES: ResourceCatalogEntry[] = [
  {
    name: "docs_howto",
    uri: "ndb://docs/howto",
    access: "public",
    title: "NetworthDB MCP how-to",
    description: "Authentication, tools vs SQL, amounts, system accounts, E2EE pass-through, AAL2.",
    mimeType: "text/markdown",
  },
  {
    name: "docs_ledger",
    uri: "ndb://docs/ledger",
    access: "public",
    title: "Ledger model",
    description: "Transactions, amounts, system accounts, imports, monthly summaries.",
    mimeType: "text/markdown",
  },
  {
    name: "docs_taxonomy",
    uri: "ndb://docs/taxonomy",
    access: "public",
    title: "Categories and tags",
    description: "Two-level categories, flat tags, per-user uniqueness.",
    mimeType: "text/markdown",
  },
  {
    name: "docs_rules",
    uri: "ndb://docs/rules",
    access: "public",
    title: "Transaction rules",
    description: "Rule groups, when expressions, actions, run_on_create and manual apply jobs.",
    mimeType: "text/markdown",
  },
  {
    name: "docs_jobs",
    uri: "ndb://docs/jobs",
    access: "public",
    title: "Background jobs",
    description: "Stages, statuses, and polling after async API calls.",
    mimeType: "text/markdown",
  },
  {
    name: "schema",
    uri: "ndb://schema",
    access: "session",
    title: "Queryable schema",
    description: "Full schema JSON for MCP SQL (same as schema_describe).",
    mimeType: "application/json",
  },
  {
    name: "schema_table",
    uriTemplate: "ndb://schema/{table}",
    access: "session",
    title: "Single table schema",
    description: "One table entry from the queryable schema catalog.",
    mimeType: "application/json",
  },
  {
    name: "me",
    uri: "ndb://me",
    access: "session",
    title: "Signed-in user",
    description: "GET /users/me as stored (display_name may be E2EE opaque).",
    mimeType: "application/json",
  },
  {
    name: "accounts",
    uri: "ndb://accounts",
    access: "session",
    title: "Accounts list",
    description: "All accounts for the signed-in user.",
    mimeType: "application/json",
  },
  {
    name: "account",
    uriTemplate: "ndb://accounts/{id}",
    access: "session",
    title: "One account",
    description: "Account details by UUID.",
    mimeType: "application/json",
  },
  {
    name: "categories",
    uri: "ndb://categories",
    access: "session",
    title: "Categories",
    description: "Category tree for the signed-in user.",
    mimeType: "application/json",
  },
  {
    name: "tags",
    uri: "ndb://tags",
    access: "session",
    title: "Tags",
    description: "Tags for the signed-in user.",
    mimeType: "application/json",
  },
  {
    name: "rule_groups",
    uri: "ndb://rule-groups",
    access: "session",
    title: "Rule groups",
    description: "Transaction rule groups for the signed-in user.",
    mimeType: "application/json",
  },
  {
    name: "system_accounts",
    uri: "ndb://system-accounts",
    access: "session",
    title: "System accounts",
    description: "unknown, revenue, expense, and tumbler account ids.",
    mimeType: "application/json",
  },
];

export const RESOURCE_CATALOG_BY_NAME = new Map(
  RESOURCE_CATALOG_ENTRIES.map((entry) => [entry.name, entry])
);
