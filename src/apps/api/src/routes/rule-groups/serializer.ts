import type { TransactionRuleGroup } from "@ndb/core";
import { ruleGroupListSchema, ruleGroupSchema } from "@ndb/platform";

function serializeRuleGroupData(group: TransactionRuleGroup) {
  return {
    id: group.id,
    sortOrder: group.sortOrder,
    active: group.active,
    title: group.title,
    description: group.description,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

export function serializeRuleGroup(group: TransactionRuleGroup) {
  return ruleGroupSchema.parse({
    data: serializeRuleGroupData(group),
  });
}

export function serializeRuleGroupList(items: TransactionRuleGroup[], total: number) {
  return ruleGroupListSchema.parse({
    items: items.map((group) => serializeRuleGroupData(group)),
    total,
  });
}
