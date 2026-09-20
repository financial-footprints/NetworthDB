import { requireSession } from "@mcp/auth/gate";
import type { SessionStore } from "@mcp/auth/session-store";
import type { McpToolDefinition } from "@mcp/helpers";
import { appendQuery, bindMethod, stripUndefined } from "@mcp/tools/helpers";
import {
  accountIdField,
  amountPaiseField,
  applyRulesBodySchema,
  isoDateField,
} from "@mcp/tools/schema";
import { SERVICE_CATALOG_BY_NAME } from "@mcp/tools/schema/inventory";
import { MAX_TAGS_PER_TRANSACTION } from "@ndb/core";
import { API, apiPath, ruleExpressionSchema } from "@ndb/platform";
import { z } from "zod";

export const RULE_TOOL_NAMES = [
  "rules_list",
  "rules_get",
  "rules_create",
  "rules_patch",
  "rules_delete",
  "rules_test",
  "rules_apply",
] as const;

const catalogItemSchema = z.object({ type: z.string().min(1) }).passthrough();

const rulesListSchema = z.object({
  groupId: z.string().uuid(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

const rulesIdSchema = z.object({
  id: z.string().uuid(),
});

const rulesCreateSchema = z.object({
  groupId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
  stopProcessing: z.boolean().optional(),
  runOnCreate: z.boolean().optional(),
  when: ruleExpressionSchema,
  actions: z.array(catalogItemSchema),
});

const rulesPatchSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
  stopProcessing: z.boolean().optional(),
  runOnCreate: z.boolean().optional(),
  when: ruleExpressionSchema.optional(),
  actions: z.array(catalogItemSchema).optional(),
});

const rulesTestSchema = rulesIdSchema.extend({
  date: isoDateField,
  amount: amountPaiseField,
  sourceAccountId: accountIdField,
  destinationAccountId: accountIdField,
  description: z.string().min(1).describe("Sample transaction description for the dry-run."),
  refNo: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  subcategoryId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).max(MAX_TAGS_PER_TRANSACTION).optional(),
  importId: z.string().uuid().nullable().optional(),
});

const rulesApplySchema = rulesIdSchema.extend(applyRulesBodySchema.shape);

function catalogEntry(name: string) {
  const entry = SERVICE_CATALOG_BY_NAME.get(name);
  if (!entry) {
    throw new Error(`mcp.tools.rules.missing-catalog.${name}`);
  }
  return entry;
}

export function createRuleTools(session: SessionStore): McpToolDefinition[] {
  return [
    bindMethod({
      catalog: catalogEntry("rules_list"),
      schema: rulesListSchema,
      invoke: async (input) => {
        requireSession(session);
        const path = appendQuery(API.rules.list, {
          groupId: input.groupId,
          limit: input.limit !== undefined ? String(input.limit) : undefined,
          offset: input.offset !== undefined ? String(input.offset) : undefined,
        });
        return session.getJson(path);
      },
    }),
    bindMethod({
      catalog: catalogEntry("rules_get"),
      schema: rulesIdSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.getJson(apiPath(API.rules.get, { ruleId: input.id }));
      },
    }),
    bindMethod({
      catalog: catalogEntry("rules_create"),
      schema: rulesCreateSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.requestJson("POST", API.rules.create, input);
      },
    }),
    bindMethod({
      catalog: catalogEntry("rules_patch"),
      schema: rulesPatchSchema,
      invoke: async (input) => {
        requireSession(session);
        const { id, ...fields } = input;
        return session.requestJson(
          "PATCH",
          apiPath(API.rules.patch, { ruleId: id }),
          stripUndefined(fields)
        );
      },
    }),
    bindMethod({
      catalog: catalogEntry("rules_delete"),
      schema: rulesIdSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.requestJson("DELETE", apiPath(API.rules.delete, { ruleId: input.id }));
      },
    }),
    bindMethod({
      catalog: catalogEntry("rules_test"),
      schema: rulesTestSchema,
      invoke: async (input) => {
        requireSession(session);
        const { id, ...body } = input;
        return session.requestJson(
          "POST",
          apiPath(API.rules.test, { ruleId: id }),
          stripUndefined(body)
        );
      },
    }),
    bindMethod({
      catalog: catalogEntry("rules_apply"),
      schema: rulesApplySchema,
      invoke: async (input) => {
        requireSession(session);
        const { id, ...body } = input;
        return session.requestJson(
          "POST",
          apiPath(API.rules.apply, { ruleId: id }),
          stripUndefined(body)
        );
      },
    }),
  ];
}
