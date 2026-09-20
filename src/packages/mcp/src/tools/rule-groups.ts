import { requireSession } from "@mcp/auth/gate";
import type { SessionStore } from "@mcp/auth/session-store";
import type { McpToolDefinition } from "@mcp/helpers";
import { appendQuery, bindMethod, stripUndefined } from "@mcp/tools/helpers";
import { applyRulesBodySchema, ruleGroupIdField } from "@mcp/tools/schema";
import { SERVICE_CATALOG_BY_NAME } from "@mcp/tools/schema/inventory";
import { API, apiPath } from "@ndb/platform";
import { z } from "zod";

export const RULE_GROUP_TOOL_NAMES = [
  "rule_groups_list",
  "rule_groups_get",
  "rule_groups_create",
  "rule_groups_patch",
  "rule_groups_delete",
  "rule_groups_apply",
] as const;

const ruleGroupsListSchema = z.object({
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

const ruleGroupsCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

const ruleGroupsPatchSchema = z.object({
  id: ruleGroupIdField,
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

const ruleGroupsIdSchema = z.object({
  id: ruleGroupIdField,
});

const ruleGroupsApplySchema = ruleGroupsIdSchema.extend(applyRulesBodySchema.shape);

function catalogEntry(name: string) {
  const entry = SERVICE_CATALOG_BY_NAME.get(name);
  if (!entry) {
    throw new Error(`mcp.tools.rule-groups.missing-catalog.${name}`);
  }
  return entry;
}

export function createRuleGroupTools(session: SessionStore): McpToolDefinition[] {
  return [
    bindMethod({
      catalog: catalogEntry("rule_groups_list"),
      schema: ruleGroupsListSchema,
      invoke: async (input) => {
        requireSession(session);
        const path = appendQuery(API.ruleGroups.list, {
          limit: input.limit !== undefined ? String(input.limit) : undefined,
          offset: input.offset !== undefined ? String(input.offset) : undefined,
        });
        return session.getJson(path);
      },
    }),
    bindMethod({
      catalog: catalogEntry("rule_groups_get"),
      schema: ruleGroupsIdSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.getJson(apiPath(API.ruleGroups.get, { ruleGroupId: input.id }));
      },
    }),
    bindMethod({
      catalog: catalogEntry("rule_groups_create"),
      schema: ruleGroupsCreateSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.requestJson("POST", API.ruleGroups.create, stripUndefined({ ...input }));
      },
    }),
    bindMethod({
      catalog: catalogEntry("rule_groups_patch"),
      schema: ruleGroupsPatchSchema,
      invoke: async (input) => {
        requireSession(session);
        const { id, ...fields } = input;
        return session.requestJson(
          "PATCH",
          apiPath(API.ruleGroups.patch, { ruleGroupId: id }),
          stripUndefined(fields)
        );
      },
    }),
    bindMethod({
      catalog: catalogEntry("rule_groups_delete"),
      schema: ruleGroupsIdSchema,
      invoke: async (input) => {
        requireSession(session);
        return session.requestJson(
          "DELETE",
          apiPath(API.ruleGroups.delete, { ruleGroupId: input.id })
        );
      },
    }),
    bindMethod({
      catalog: catalogEntry("rule_groups_apply"),
      schema: ruleGroupsApplySchema,
      invoke: async (input) => {
        requireSession(session);
        const { id, ...body } = input;
        return session.requestJson(
          "POST",
          apiPath(API.ruleGroups.apply, { ruleGroupId: id }),
          stripUndefined(body)
        );
      },
    }),
  ];
}
