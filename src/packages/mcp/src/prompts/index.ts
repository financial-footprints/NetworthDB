import { requireSession } from "@mcp/auth/gate";
import type { SessionStore } from "@mcp/auth/session-store";
import { PROMPT_CATALOG_BY_NAME } from "@mcp/prompts/catalog";
import {
  ACCOUNT_COVERAGE_INSTRUCTION,
  CASHFLOW_INSTRUCTION,
  DRAFT_RULE_INSTRUCTION,
  DUPLICATE_SCAN_INSTRUCTION,
  EXPLAIN_BALANCE_INSTRUCTION,
  MONTHLY_REVIEW_INSTRUCTION,
  NET_WORTH_SNAPSHOT_INSTRUCTION,
  RULE_APPLY_DRY_RUN_INSTRUCTION,
  SPENDING_BY_CATEGORY_INSTRUCTION,
  UNCATEGORIZED_INSTRUCTION,
} from "@mcp/prompts/instructions";
import { promptUserMessage } from "@mcp/prompts/message";
import type { McpPromptDefinition } from "@mcp/prompts/types";
import { z } from "zod";

export type CreateMcpPromptsOptions = {
  session: SessionStore;
};

const isoDateSchema = z.string().min(1).describe("Calendar date YYYY-MM-DD or ISO datetime.");

const uuidSchema = z.string().uuid();

function requireCatalog(name: string) {
  const entry = PROMPT_CATALOG_BY_NAME.get(name);
  if (!entry) {
    throw new Error(`mcp.prompts.catalog-entry.missing.${name}`);
  }
  return entry;
}

function definePrompt(
  name: string,
  schema: McpPromptDefinition["schema"],
  instruction: string,
  session: SessionStore
): McpPromptDefinition {
  const entry = requireCatalog(name);
  return {
    name: entry.name,
    title: entry.title,
    description: entry.description,
    schema,
    handler: async (args) => {
      requireSession(session);
      const argsJson = JSON.stringify(args, null, 2);
      return promptUserMessage(`${instruction}

Arguments:
${argsJson}`);
    },
  };
}

export function createMcpPrompts(options: CreateMcpPromptsOptions): McpPromptDefinition[] {
  const { session } = options;

  return [
    definePrompt(
      "monthly_review",
      z.object({
        from: isoDateSchema,
        to: isoDateSchema,
        account_id: uuidSchema.optional(),
      }),
      MONTHLY_REVIEW_INSTRUCTION,
      session
    ),
    definePrompt(
      "spending_by_category",
      z.object({
        from: isoDateSchema,
        to: isoDateSchema,
      }),
      SPENDING_BY_CATEGORY_INSTRUCTION,
      session
    ),
    definePrompt(
      "uncategorized",
      z.object({
        from: isoDateSchema,
        to: isoDateSchema,
      }),
      UNCATEGORIZED_INSTRUCTION,
      session
    ),
    definePrompt(
      "cashflow",
      z.object({
        from: isoDateSchema,
        to: isoDateSchema,
      }),
      CASHFLOW_INSTRUCTION,
      session
    ),
    definePrompt(
      "explain_balance",
      z.object({
        account_id: uuidSchema,
        date: isoDateSchema,
      }),
      EXPLAIN_BALANCE_INSTRUCTION,
      session
    ),
    definePrompt(
      "account_coverage",
      z.object({
        account_id: uuidSchema.optional(),
      }),
      ACCOUNT_COVERAGE_INSTRUCTION,
      session
    ),
    definePrompt(
      "draft_rule",
      z.object({
        example: z.string().min(1).describe("Example merchant, description, or pattern."),
      }),
      DRAFT_RULE_INSTRUCTION,
      session
    ),
    definePrompt(
      "rule_apply_dry_run",
      z.object({
        rule_id: uuidSchema.optional(),
        group_id: uuidSchema.optional(),
        filters: z.record(z.string(), z.unknown()).optional(),
      }),
      RULE_APPLY_DRY_RUN_INSTRUCTION,
      session
    ),
    definePrompt(
      "duplicate_scan",
      z.object({
        account_id: uuidSchema.optional(),
        from: isoDateSchema.optional(),
        to: isoDateSchema.optional(),
      }),
      DUPLICATE_SCAN_INSTRUCTION,
      session
    ),
    definePrompt(
      "net_worth_snapshot",
      z.object({
        as_of: isoDateSchema,
      }),
      NET_WORTH_SNAPSHOT_INSTRUCTION,
      session
    ),
  ];
}
