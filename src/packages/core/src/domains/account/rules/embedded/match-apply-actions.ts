import {
  categoryTaxonomyWarning,
  type TransactionRebuildPatch,
  tryRebuild,
} from "@core/domains/account/rules/embedded/match-apply-rebuild";
import type {
  ApplyActionsResult,
  RuleAction,
  RuleEvalContext,
} from "@core/domains/account/rules/embedded/types";
import { MAX_TAGS_PER_TRANSACTION } from "@core/domains/account/taxonomy/constants";
import type { Transaction } from "@core/domains/account/transactions/entities/transaction";

function applyRebuild(
  transaction: Transaction,
  context: RuleEvalContext,
  patch: TransactionRebuildPatch,
  warnings: string[] = []
): ApplyActionsResult {
  const rebuilt = tryRebuild(transaction, patch, context);
  if (!rebuilt.ok) {
    return { transaction, deleted: false, warnings: [...warnings, rebuilt.warning] };
  }
  return { transaction: rebuilt.transaction, deleted: false, warnings };
}

function applySetCategory(
  transaction: Transaction,
  action: Extract<RuleAction, { type: "set_category" }>,
  context: RuleEvalContext
): ApplyActionsResult {
  const warn = categoryTaxonomyWarning(context, action.categoryId, action.subcategoryId);
  if (warn) {
    return { transaction, deleted: false, warnings: [warn] };
  }
  return applyRebuild(transaction, context, {
    categoryId: action.categoryId,
    subcategoryId: action.subcategoryId,
  });
}

function applyAddTag(
  transaction: Transaction,
  action: Extract<RuleAction, { type: "add_tag" }>,
  context: RuleEvalContext
): ApplyActionsResult {
  const warnings: string[] = [];
  if (transaction.tagIds.includes(action.tagId)) {
    return { transaction, deleted: false, warnings };
  }
  if (!context.tagsById.has(action.tagId)) {
    return { transaction, deleted: false, warnings: ["Tag was not found."] };
  }
  if (transaction.tagIds.length >= MAX_TAGS_PER_TRANSACTION) {
    return { transaction, deleted: false, warnings: ["Too many tags."] };
  }
  return applyRebuild(transaction, context, {
    tagIds: [...transaction.tagIds, action.tagId],
  });
}

function applyRemoveTag(
  transaction: Transaction,
  action: Extract<RuleAction, { type: "remove_tag" }>,
  context: RuleEvalContext
): ApplyActionsResult {
  const warnings: string[] = [];
  const tagIds = transaction.tagIds.filter((id) => id !== action.tagId);
  if (tagIds.length === transaction.tagIds.length) {
    return { transaction, deleted: false, warnings };
  }
  return applyRebuild(transaction, context, { tagIds });
}

function applySetTags(
  transaction: Transaction,
  action: Extract<RuleAction, { type: "set_tags" }>,
  context: RuleEvalContext
): ApplyActionsResult {
  for (const tagId of action.tagIds) {
    if (!context.tagsById.has(tagId)) {
      return { transaction, deleted: false, warnings: ["Tag was not found."] };
    }
  }
  return applyRebuild(transaction, context, { tagIds: action.tagIds });
}

function applySetDescription(
  transaction: Transaction,
  action: Extract<RuleAction, { type: "set_description" }>,
  context: RuleEvalContext
): ApplyActionsResult {
  const value = action.value.trim();
  if (!value) {
    return { transaction, deleted: false, warnings: ["Replacement text is invalid."] };
  }
  return applyRebuild(transaction, context, { description: value });
}

function applyAppendDescription(
  transaction: Transaction,
  action: Extract<RuleAction, { type: "append_description" }>,
  context: RuleEvalContext
): ApplyActionsResult {
  const addition = action.value.trim();
  if (!addition) {
    return { transaction, deleted: false, warnings: ["Replacement text is invalid."] };
  }
  const description =
    transaction.description.trim().length > 0
      ? `${transaction.description.trim()} ${addition}`
      : addition;
  return applyRebuild(transaction, context, { description });
}

function applyPrependDescription(
  transaction: Transaction,
  action: Extract<RuleAction, { type: "prepend_description" }>,
  context: RuleEvalContext
): ApplyActionsResult {
  const addition = action.value.trim();
  if (!addition) {
    return { transaction, deleted: false, warnings: ["Replacement text is invalid."] };
  }
  const description =
    transaction.description.trim().length > 0
      ? `${addition} ${transaction.description.trim()}`
      : addition;
  return applyRebuild(transaction, context, { description });
}

function applyReplaceInDescription(
  transaction: Transaction,
  action: Extract<RuleAction, { type: "replace_in_description" }>,
  context: RuleEvalContext
): ApplyActionsResult {
  const warnings: string[] = [];
  const find = action.find.trim();
  if (!find) {
    return { transaction, deleted: false, warnings: ["Replacement text is invalid."] };
  }
  const lower = transaction.description.toLowerCase();
  const needle = find.toLowerCase();
  const index = lower.indexOf(needle);
  if (index < 0) {
    return { transaction, deleted: false, warnings };
  }
  const description =
    transaction.description.slice(0, index) +
    action.replace +
    transaction.description.slice(index + find.length);
  return applyRebuild(transaction, context, { description });
}

function applySetRefNo(
  transaction: Transaction,
  action: Extract<RuleAction, { type: "set_ref_no" }>,
  context: RuleEvalContext
): ApplyActionsResult {
  const value = action.value.trim();
  if (!value) {
    return { transaction, deleted: false, warnings: ["Replacement text is invalid."] };
  }
  return applyRebuild(transaction, context, { refNo: value });
}

function applySetSourceAccount(
  transaction: Transaction,
  action: Extract<RuleAction, { type: "set_source_account" }>,
  context: RuleEvalContext
): ApplyActionsResult {
  const account = context.accountsById.get(action.accountId);
  if (!account) {
    return { transaction, deleted: false, warnings: ["Account was not found."] };
  }
  const result = applyRebuild(transaction, context, { sourceAccountId: action.accountId });
  if (result.deleted) {
    return result;
  }
  context.source = account;
  return result;
}

function applySetDestinationAccount(
  transaction: Transaction,
  action: Extract<RuleAction, { type: "set_destination_account" }>,
  context: RuleEvalContext
): ApplyActionsResult {
  const account = context.accountsById.get(action.accountId);
  if (!account) {
    return { transaction, deleted: false, warnings: ["Account was not found."] };
  }
  const result = applyRebuild(transaction, context, { destinationAccountId: action.accountId });
  if (result.deleted) {
    return result;
  }
  context.dest = account;
  return result;
}

function applySetSourceSystem(
  transaction: Transaction,
  action: Extract<RuleAction, { type: "set_source_system" }>,
  context: RuleEvalContext
): ApplyActionsResult {
  const account = context.systemByType[action.accountType];
  if (!account) {
    return { transaction, deleted: false, warnings: ["System account was not found."] };
  }
  const result = applyRebuild(transaction, context, { sourceAccountId: account.id });
  if (result.deleted) {
    return result;
  }
  context.source = account;
  return result;
}

function applySetDestinationSystem(
  transaction: Transaction,
  action: Extract<RuleAction, { type: "set_destination_system" }>,
  context: RuleEvalContext
): ApplyActionsResult {
  const account = context.systemByType[action.accountType];
  if (!account) {
    return { transaction, deleted: false, warnings: ["System account was not found."] };
  }
  const result = applyRebuild(transaction, context, { destinationAccountId: account.id });
  if (result.deleted) {
    return result;
  }
  context.dest = account;
  return result;
}

export function applyOneAction(
  transaction: Transaction,
  action: RuleAction,
  context: RuleEvalContext
): ApplyActionsResult {
  switch (action.type) {
    case "set_category":
      return applySetCategory(transaction, action, context);
    case "clear_category":
      return applyRebuild(transaction, context, { categoryId: null, subcategoryId: null });
    case "add_tag":
      return applyAddTag(transaction, action, context);
    case "remove_tag":
      return applyRemoveTag(transaction, action, context);
    case "clear_tags":
      return applyRebuild(transaction, context, { tagIds: [] });
    case "set_tags":
      return applySetTags(transaction, action, context);
    case "set_description":
      return applySetDescription(transaction, action, context);
    case "append_description":
      return applyAppendDescription(transaction, action, context);
    case "prepend_description":
      return applyPrependDescription(transaction, action, context);
    case "replace_in_description":
      return applyReplaceInDescription(transaction, action, context);
    case "set_ref_no":
      return applySetRefNo(transaction, action, context);
    case "clear_ref_no":
      return applyRebuild(transaction, context, { refNo: null });
    case "set_source_account":
      return applySetSourceAccount(transaction, action, context);
    case "set_destination_account":
      return applySetDestinationAccount(transaction, action, context);
    case "set_source_system":
      return applySetSourceSystem(transaction, action, context);
    case "set_destination_system":
      return applySetDestinationSystem(transaction, action, context);
    case "delete_transaction":
      return { transaction, deleted: true, warnings: [] };
    default:
      return { transaction, deleted: false, warnings: ["Action type is invalid."] };
  }
}
