import type { RuleAction, TransactionRule } from "@ndb/core";
import { ruleListSchema, ruleSchema, testRuleSchema } from "@ndb/platform";

function serializeRuleData(rule: TransactionRule) {
  return {
    id: rule.id,
    groupId: rule.groupId,
    sortOrder: rule.sortOrder,
    active: rule.active,
    stopProcessing: rule.stopProcessing,
    runOnCreate: rule.runOnCreate,
    title: rule.title,
    description: rule.description,
    when: rule.when,
    actions: rule.actions,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

export function serializeRule(rule: TransactionRule) {
  return ruleSchema.parse({
    data: serializeRuleData(rule),
  });
}

export function serializeRuleList(items: TransactionRule[], total: number) {
  return ruleListSchema.parse({
    items: items.map((rule) => serializeRuleData(rule)),
    total,
  });
}

export function serializeTestRuleResult(result: {
  matched: boolean;
  actions: RuleAction[];
  warnings: string[];
}) {
  return testRuleSchema.parse({
    data: {
      matched: result.matched,
      actions: result.actions,
      warnings: result.warnings,
    },
  });
}
