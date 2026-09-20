import type { CatalogAccess } from "@mcp/helpers";

export type PromptCatalogEntry = {
  name: string;
  access: CatalogAccess;
  title: string;
  description: string;
};

export const PROMPT_CATALOG_ENTRIES: PromptCatalogEntry[] = [
  {
    name: "monthly_review",
    access: "session",
    title: "Monthly review",
    description:
      "Summarize spending and activity between two dates, optionally scoped to one account.",
  },
  {
    name: "spending_by_category",
    access: "session",
    title: "Spending by category",
    description: "Aggregate spend by category for a date range using SQL.",
  },
  {
    name: "uncategorized",
    access: "session",
    title: "Uncategorized transactions",
    description: "Find ledger rows with no category in a date range.",
  },
  {
    name: "cashflow",
    access: "session",
    title: "Cashflow",
    description: "Income vs expense style cashflow for a date range.",
  },
  {
    name: "explain_balance",
    access: "session",
    title: "Explain balance",
    description: "Explain an account balance as of a calendar date.",
  },
  {
    name: "account_coverage",
    access: "session",
    title: "Account coverage",
    description: "Which accounts have statements or recent activity.",
  },
  {
    name: "draft_rule",
    access: "session",
    title: "Draft a rule",
    description: "Propose triggers and actions from an example merchant or description.",
  },
  {
    name: "rule_apply_dry_run",
    access: "session",
    title: "Rule apply dry-run",
    description: "Plan how to evaluate a rule or group without applying (jobs tools arrive later).",
  },
  {
    name: "duplicate_scan",
    access: "session",
    title: "Duplicate scan",
    description: "Look for likely duplicate transactions in a date range.",
  },
  {
    name: "net_worth_snapshot",
    access: "session",
    title: "Net worth snapshot",
    description: "Approximate net worth as of a date using accounts and balances.",
  },
];

export const PROMPT_CATALOG_BY_NAME = new Map(
  PROMPT_CATALOG_ENTRIES.map((entry) => [entry.name, entry])
);
