import type { ServiceCatalogEntry } from "@mcp/tools/schema/inventory";
import { z } from "zod";

export const emptyArgsSchema = z.object({}).describe("No arguments.");

export const accountIdField = z
  .string()
  .uuid()
  .describe("Account uuid (ledger scope or account resource id).");

export const transactionIdField = z.string().uuid().describe("Transaction row uuid.");

export const ruleGroupIdField = z.string().uuid().describe("Transaction rule group uuid.");

export const isoDateField = z
  .string()
  .min(1)
  .describe("Calendar date YYYY-MM-DD or ISO datetime string.");

export const amountPaiseField = z
  .number()
  .int()
  .positive()
  .describe("Amount in integer rupees × 100 (positive).");

export const importIdField = z.string().uuid().describe("Transaction import batch uuid.");

export const applyRulesBodySchema = z.object({
  from: isoDateField.optional(),
  to: isoDateField.optional(),
  accountId: accountIdField.optional(),
  word: z.string().optional().describe("Description substring filter."),
  categoryId: z.string().uuid().optional().describe("Category uuid filter."),
  subcategoryId: z.string().uuid().optional().describe("Subcategory uuid filter."),
  tagId: z.string().uuid().optional().describe("Tag uuid filter."),
  dryRun: z
    .boolean()
    .optional()
    .describe("When true, job still runs but does not persist changes."),
});

function formatAuth(access: ServiceCatalogEntry["access"]): string {
  return access === "public" ? "none" : "session required";
}

export function formatToolDescription(entry: ServiceCatalogEntry): string {
  const insteadLine = entry.instead ? `\nPrefer instead: ${entry.instead}` : "";
  return `${entry.summary}

Auth: ${formatAuth(entry.access)}
Use when: ${entry.relevance}${insteadLine}
Returns: ${entry.returns}`;
}
