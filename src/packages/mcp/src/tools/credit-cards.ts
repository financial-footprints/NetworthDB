import { requireSession } from "@mcp/auth/gate";
import type { SessionStore } from "@mcp/auth/session-store";
import type { McpToolDefinition } from "@mcp/helpers";
import { appendQuery, bindMethod } from "@mcp/tools/helpers";
import { emptyArgsSchema } from "@mcp/tools/schema";
import { SERVICE_CATALOG_BY_NAME } from "@mcp/tools/schema/inventory";
import { API, apiPath } from "@ndb/platform";
import { z } from "zod";

export const CREDIT_CARD_TOOL_NAMES = [
  "credit_cards_catalog_list",
  "credit_cards_catalog_get",
  "credit_cards_catalog_bulk",
  "credit_cards_benefits_get",
] as const;

const creditCardsCatalogListSchema = z.object({
  tag: z.string().min(1).optional(),
});

const creditCardsCatalogGetSchema = z.object({
  bank: z.string().min(1),
  variant: z.string().min(1),
});

const creditCardsBenefitsGetSchema = z.object({
  slotId: z.string().min(1),
});

function catalogEntry(name: string) {
  const entry = SERVICE_CATALOG_BY_NAME.get(name);
  if (!entry) {
    throw new Error(`mcp.tools.credit-cards.missing-catalog.${name}`);
  }
  return entry;
}

export function createCreditCardTools(session: SessionStore): McpToolDefinition[] {
  return [
    bindMethod({
      catalog: catalogEntry("credit_cards_catalog_list"),
      schema: creditCardsCatalogListSchema,
      invoke: async (input) => {
        requireSession(session);
        const path = appendQuery(API.creditCards.catalog.list, {
          tag: input.tag,
        });
        return session.getJson(path);
      },
    }),
    bindMethod({
      catalog: catalogEntry("credit_cards_catalog_get"),
      schema: creditCardsCatalogGetSchema,
      invoke: async (input) => {
        requireSession(session);
        const path = apiPath(API.creditCards.catalog.get, {
          bank: input.bank,
          variant: input.variant,
        });
        return session.getJson(path);
      },
    }),
    bindMethod({
      catalog: catalogEntry("credit_cards_catalog_bulk"),
      schema: emptyArgsSchema,
      invoke: async () => {
        requireSession(session);
        return session.getJson(API.creditCards.catalog.bulk);
      },
    }),
    bindMethod({
      catalog: catalogEntry("credit_cards_benefits_get"),
      schema: creditCardsBenefitsGetSchema,
      invoke: async (input) => {
        requireSession(session);
        const path = apiPath(API.creditCards.benefits.get, {
          slotId: input.slotId,
        });
        return session.getJson(path);
      },
    }),
  ];
}
