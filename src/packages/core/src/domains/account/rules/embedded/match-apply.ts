import { isInstrumentAccountType, isSystemAccountType } from "@core/domains/account/constants";
import type { Account } from "@core/domains/account/entities/account";
import { applyOneAction } from "@core/domains/account/rules/embedded/match-apply-actions";
import type {
  ApplyActionsResult,
  RuleAction,
  RuleEvalContext,
  RuleExpression,
  RuleTrigger,
  WalkRulesResult,
} from "@core/domains/account/rules/embedded/types";
import type { TransactionRule } from "@core/domains/account/rules/entities/transaction-rule";
import type { TransactionRuleGroup } from "@core/domains/account/rules/entities/transaction-rule-group";
import type { Transaction } from "@core/domains/account/transactions/entities/transaction";
import {
  isIncomeCounterpart,
  isSpendCounterpart,
} from "@core/domains/account/transactions/helpers";
import { Time } from "@core/shared/time";

function ci(text: string): string {
  return text.trim().toLowerCase();
}

function refText(refNo: string | null): string {
  return refNo?.trim() ?? "";
}

function isoWeekday(iso: string): number {
  const day = Time.toUtcDate(iso).getUTCDay();
  return day === 0 ? 7 : day;
}

function pairIsTransfer(source: Account, dest: Account): boolean {
  return isInstrumentAccountType(source.accountType) && isInstrumentAccountType(dest.accountType);
}

function pairIsSpend(source: Account, dest: Account): boolean {
  return isInstrumentAccountType(source.accountType) && isSpendCounterpart(dest.accountType);
}

function pairIsIncome(source: Account, dest: Account): boolean {
  return isInstrumentAccountType(dest.accountType) && isIncomeCounterpart(source.accountType);
}

function matchOneTrigger(
  transaction: Transaction,
  trigger: RuleTrigger,
  context: RuleEvalContext
): boolean {
  const desc = ci(transaction.description);
  const ref = refText(transaction.refNo);
  const source = context.accountsById.get(transaction.sourceAccountId) ?? context.source;
  const dest = context.accountsById.get(transaction.destinationAccountId) ?? context.dest;

  switch (trigger.type) {
    case "description_contains":
      return desc.includes(ci(trigger.value));
    case "description_not_contains":
      return !desc.includes(ci(trigger.value));
    case "description_is":
      return desc === ci(trigger.value);
    case "description_is_not":
      return desc !== ci(trigger.value);
    case "description_starts":
      return desc.startsWith(ci(trigger.value));
    case "description_ends":
      return desc.endsWith(ci(trigger.value));
    case "description_matches_regex":
      return new RegExp(trigger.value, "iu").test(transaction.description);
    case "ref_contains":
      return ref.length > 0 && ci(ref).includes(ci(trigger.value));
    case "ref_not_contains":
      return ref.length === 0 || !ci(ref).includes(ci(trigger.value));
    case "ref_is":
      return ref.length > 0 && ci(ref) === ci(trigger.value);
    case "ref_is_not":
      return ref.length === 0 || ci(ref) !== ci(trigger.value);
    case "ref_starts":
      return ref.length > 0 && ci(ref).startsWith(ci(trigger.value));
    case "ref_ends":
      return ref.length > 0 && ci(ref).endsWith(ci(trigger.value));
    case "ref_matches_regex":
      return ref.length > 0 && new RegExp(trigger.value, "iu").test(ref);
    case "ref_is_empty":
      return ref.length === 0;
    case "ref_is_set":
      return ref.length > 0;
    case "amount_exactly":
      return transaction.amount === trigger.amount;
    case "amount_not":
      return transaction.amount !== trigger.amount;
    case "amount_less":
      return transaction.amount < trigger.amount;
    case "amount_less_or_equal":
      return transaction.amount <= trigger.amount;
    case "amount_greater":
      return transaction.amount > trigger.amount;
    case "amount_greater_or_equal":
      return transaction.amount >= trigger.amount;
    case "amount_between":
      return transaction.amount >= trigger.min && transaction.amount <= trigger.max;
    case "date_is":
      return transaction.date === trigger.date;
    case "date_is_not":
      return transaction.date !== trigger.date;
    case "date_before":
      return Time.compareIsoDates(transaction.date, trigger.date) < 0;
    case "date_after":
      return Time.compareIsoDates(transaction.date, trigger.date) > 0;
    case "date_on_or_before":
      return Time.compareIsoDates(transaction.date, trigger.date) <= 0;
    case "date_on_or_after":
      return Time.compareIsoDates(transaction.date, trigger.date) >= 0;
    case "date_between":
      return (
        Time.compareIsoDates(transaction.date, trigger.from) >= 0 &&
        Time.compareIsoDates(transaction.date, trigger.to) <= 0
      );
    case "date_weekday_is":
      return isoWeekday(transaction.date) === trigger.weekday;
    case "date_month_is":
      return Time.yearMonthFromIso(transaction.date).month === trigger.month;
    case "source_account_is":
      return transaction.sourceAccountId === trigger.accountId;
    case "source_account_is_not":
      return transaction.sourceAccountId !== trigger.accountId;
    case "destination_account_is":
      return transaction.destinationAccountId === trigger.accountId;
    case "destination_account_is_not":
      return transaction.destinationAccountId !== trigger.accountId;
    case "either_account_is":
      return (
        transaction.sourceAccountId === trigger.accountId ||
        transaction.destinationAccountId === trigger.accountId
      );
    case "either_account_is_not":
      return (
        transaction.sourceAccountId !== trigger.accountId &&
        transaction.destinationAccountId !== trigger.accountId
      );
    case "source_account_type_is":
      return source.accountType === trigger.accountType;
    case "destination_account_type_is":
      return dest.accountType === trigger.accountType;
    case "either_account_type_is":
      return source.accountType === trigger.accountType || dest.accountType === trigger.accountType;
    case "source_is_system":
      return isSystemAccountType(source.accountType);
    case "destination_is_system":
      return isSystemAccountType(dest.accountType);
    case "source_is_instrument":
      return isInstrumentAccountType(source.accountType);
    case "destination_is_instrument":
      return isInstrumentAccountType(dest.accountType);
    case "pair_is_transfer":
      return pairIsTransfer(source, dest);
    case "pair_is_spend":
      return pairIsSpend(source, dest);
    case "pair_is_income":
      return pairIsIncome(source, dest);
    case "category_is":
      return transaction.categoryId === trigger.categoryId;
    case "category_is_not":
      return transaction.categoryId !== trigger.categoryId;
    case "has_category":
      return transaction.categoryId !== null;
    case "has_no_category":
      return transaction.categoryId === null;
    case "subcategory_is":
      return transaction.subcategoryId === trigger.subcategoryId;
    case "subcategory_is_not":
      return transaction.subcategoryId !== trigger.subcategoryId;
    case "tag_is":
      return transaction.tagIds.includes(trigger.tagId);
    case "tag_is_not":
      return !transaction.tagIds.includes(trigger.tagId);
    case "has_no_tags":
      return transaction.tagIds.length === 0;
    case "has_any_tag":
      return transaction.tagIds.length > 0;
    case "has_import":
      return transaction.importId !== null;
    case "has_no_import":
      return transaction.importId === null;
    case "import_id_is":
      return transaction.importId === trigger.importId;
    default:
      return false;
  }
}

export function matchWhen(
  transaction: Transaction,
  expression: RuleExpression,
  context: RuleEvalContext
): boolean {
  if ("op" in expression) {
    if (expression.items.length === 0) {
      return false;
    }
    if (expression.op === "and") {
      return expression.items.every((item) => matchWhen(transaction, item, context));
    }
    return expression.items.some((item) => matchWhen(transaction, item, context));
  }
  return matchOneTrigger(transaction, expression, context);
}

export function applyActions(
  transaction: Transaction,
  actions: RuleAction[],
  context: RuleEvalContext
): ApplyActionsResult {
  let current = transaction;
  const warnings: string[] = [];
  if (actions.length === 0) {
    return { transaction: current, deleted: false, warnings };
  }
  for (const action of actions) {
    const result = applyOneAction(current, action, context);
    warnings.push(...result.warnings);
    if (result.deleted) {
      return { transaction: result.transaction, deleted: true, warnings };
    }
    current = result.transaction;
  }
  return { transaction: current, deleted: false, warnings };
}

function sortGroups(groups: TransactionRuleGroup[]): TransactionRuleGroup[] {
  return [...groups].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }
    const created = left.createdAt.localeCompare(right.createdAt);
    if (created !== 0) {
      return created;
    }
    return left.id.localeCompare(right.id);
  });
}

function sortRules(rules: TransactionRule[]): TransactionRule[] {
  return [...rules].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }
    const created = left.createdAt.localeCompare(right.createdAt);
    if (created !== 0) {
      return created;
    }
    return left.id.localeCompare(right.id);
  });
}

function applyMatchingRule(
  current: Transaction,
  rule: TransactionRule,
  context: RuleEvalContext
): {
  current: Transaction;
  deleted: boolean;
  stopped: boolean;
  matched: boolean;
  warnings: string[];
} {
  if (!matchWhen(current, rule.when, context)) {
    return { current, deleted: false, stopped: false, matched: false, warnings: [] };
  }
  const applied = applyActions(current, rule.actions, context);
  return {
    current: applied.transaction,
    deleted: applied.deleted,
    stopped: applied.deleted || rule.stopProcessing,
    matched: true,
    warnings: applied.warnings,
  };
}

function applyRulesInGroup(
  current: Transaction,
  group: TransactionRuleGroup,
  rulesByGroupId: Map<string, TransactionRule[]>,
  context: RuleEvalContext
): {
  current: Transaction;
  deleted: boolean;
  stopped: boolean;
  matched: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  let next = current;
  let deleted = false;
  let stopped = false;
  let matched = false;
  const rules = sortRules(rulesByGroupId.get(group.id) ?? []);
  for (const rule of rules) {
    if (stopped || !rule.active) {
      continue;
    }
    const outcome = applyMatchingRule(next, rule, context);
    if (!outcome.matched) {
      continue;
    }
    matched = true;
    next = outcome.current;
    warnings.push(...outcome.warnings);
    if (outcome.stopped) {
      deleted = outcome.deleted;
      stopped = true;
      break;
    }
  }
  return { current: next, deleted, stopped, matched, warnings };
}

export function walkRules(
  transaction: Transaction,
  groups: TransactionRuleGroup[],
  rulesByGroupId: Map<string, TransactionRule[]>,
  context: RuleEvalContext
): WalkRulesResult {
  let current = transaction;
  const warnings: string[] = [];
  let stopped = false;
  let deleted = false;
  let matched = false;

  for (const group of sortGroups(groups)) {
    if (stopped || !group.active) {
      continue;
    }
    const outcome = applyRulesInGroup(current, group, rulesByGroupId, context);
    if (outcome.matched) {
      matched = true;
    }
    current = outcome.current;
    warnings.push(...outcome.warnings);
    if (outcome.stopped) {
      deleted = outcome.deleted;
      stopped = true;
    }
  }

  return { transaction: current, deleted, warnings, stopped, matched };
}
