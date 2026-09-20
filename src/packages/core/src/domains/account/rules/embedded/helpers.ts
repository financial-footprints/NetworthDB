import { ACCOUNT_TYPES, type AccountType } from "@core/domains/account/constants";
import {
  MAX_ACTIONS_PER_RULE,
  MAX_TRIGGER_STRING_LEN,
  MAX_TRIGGERS_PER_RULE,
  MAX_WHEN_DEPTH,
  RULE_ACTION_TYPES,
  RULE_TRIGGER_TYPES,
  type RuleActionType,
  type RuleTriggerType,
} from "@core/domains/account/rules/constants";
import type {
  DestinationSystemAccountType,
  RuleAction,
  RuleExpression,
  RuleTrigger,
  SourceSystemAccountType,
} from "@core/domains/account/rules/embedded/types";
import { ValidationError } from "@core/shared/errors/domain-error";
import { Time } from "@core/shared/time";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SOURCE_SYSTEM_TYPES: SourceSystemAccountType[] = ["unknown", "revenue", "tumbler"];
const DEST_SYSTEM_TYPES: DestinationSystemAccountType[] = ["unknown", "expense", "tumbler"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTriggerType(value: unknown): RuleTriggerType {
  if (typeof value !== "string" || !(RULE_TRIGGER_TYPES as readonly string[]).includes(value)) {
    throw new ValidationError("Invalid type.", { field: "type", value });
  }
  return value as RuleTriggerType;
}

function parseActionType(value: unknown): RuleActionType {
  if (typeof value !== "string" || !(RULE_ACTION_TYPES as readonly string[]).includes(value)) {
    throw new ValidationError("Invalid type.", { field: "type", value });
  }
  return value as RuleActionType;
}

function parseNonEmptyString(field: string, value: unknown, message: string): string {
  if (typeof value !== "string") {
    throw new ValidationError(message, { field });
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_TRIGGER_STRING_LEN) {
    throw new ValidationError(message, { field });
  }
  return trimmed;
}

export function parseRegexPattern(value: string): void {
  try {
    new RegExp(value, "iu");
  } catch {
    throw new ValidationError("Invalid regex.");
  }
}

export function parsePositiveAmount(field: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ValidationError("Invalid amount.", { field });
  }
  return value;
}

export function parseUuid(field: string, value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new ValidationError("Invalid uuid.", { field });
  }
  return value;
}

export function parseIsoDayField(field: string, value: unknown): string {
  if (typeof value !== "string") {
    throw new ValidationError("Invalid date.", { field });
  }
  return Time.parseIsoDate(value, field);
}

export function parseAccountTypeField(value: unknown): AccountType {
  if (typeof value !== "string" || !(ACCOUNT_TYPES as readonly string[]).includes(value)) {
    throw new ValidationError("Invalid account type.");
  }
  return value as AccountType;
}

export function parseWeekday(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 7) {
    throw new ValidationError("Invalid weekday.");
  }
  return value;
}

export function parseMonth(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 12) {
    throw new ValidationError("Invalid month.");
  }
  return value;
}

function parseSourceSystemType(value: unknown): SourceSystemAccountType {
  if (typeof value !== "string" || !(SOURCE_SYSTEM_TYPES as readonly string[]).includes(value)) {
    throw new ValidationError("Invalid system type.");
  }
  return value as SourceSystemAccountType;
}

function parseDestinationSystemType(value: unknown): DestinationSystemAccountType {
  if (typeof value !== "string" || !(DEST_SYSTEM_TYPES as readonly string[]).includes(value)) {
    throw new ValidationError("Invalid system type.");
  }
  return value as DestinationSystemAccountType;
}

function parseTriggerItem(raw: unknown): RuleTrigger {
  if (!isRecord(raw)) {
    throw new ValidationError("Invalid JSON.");
  }
  const type = parseTriggerType(raw.type);
  switch (type) {
    case "description_contains":
    case "description_not_contains":
    case "description_is":
    case "description_is_not":
    case "description_starts":
    case "description_ends":
    case "description_matches_regex":
    case "ref_contains":
    case "ref_not_contains":
    case "ref_is":
    case "ref_is_not":
    case "ref_starts":
    case "ref_ends":
    case "ref_matches_regex": {
      const value = parseNonEmptyString("value", raw.value, "Invalid trigger value.");
      if (type.endsWith("_matches_regex")) {
        parseRegexPattern(value);
      }
      return { type, value };
    }
    case "ref_is_empty":
    case "ref_is_set":
    case "source_is_system":
    case "destination_is_system":
    case "source_is_instrument":
    case "destination_is_instrument":
    case "pair_is_transfer":
    case "pair_is_spend":
    case "pair_is_income":
    case "has_category":
    case "has_no_category":
    case "has_no_tags":
    case "has_any_tag":
    case "has_import":
    case "has_no_import":
      return { type };
    case "amount_exactly":
    case "amount_not":
    case "amount_less":
    case "amount_less_or_equal":
    case "amount_greater":
    case "amount_greater_or_equal":
      return { type, amount: parsePositiveAmount("amount", raw.amount) };
    case "amount_between": {
      const min = parsePositiveAmount("min", raw.min);
      const max = parsePositiveAmount("max", raw.max);
      if (min > max) {
        throw new ValidationError("Invalid range.");
      }
      return { type, min, max };
    }
    case "date_is":
    case "date_is_not":
    case "date_before":
    case "date_after":
    case "date_on_or_before":
    case "date_on_or_after":
      return { type, date: parseIsoDayField("date", raw.date) };
    case "date_between": {
      const from = parseIsoDayField("from", raw.from);
      const to = parseIsoDayField("to", raw.to);
      if (Time.compareIsoDates(from, to) > 0) {
        throw new ValidationError("Invalid range.");
      }
      return { type, from, to };
    }
    case "date_weekday_is":
      return { type, weekday: parseWeekday(raw.weekday) };
    case "date_month_is":
      return { type, month: parseMonth(raw.month) };
    case "source_account_is":
    case "source_account_is_not":
    case "destination_account_is":
    case "destination_account_is_not":
    case "either_account_is":
    case "either_account_is_not":
      return { type, accountId: parseUuid("accountId", raw.accountId) };
    case "source_account_type_is":
    case "destination_account_type_is":
    case "either_account_type_is":
      return { type, accountType: parseAccountTypeField(raw.accountType) };
    case "category_is":
    case "category_is_not":
      return { type, categoryId: parseUuid("categoryId", raw.categoryId) };
    case "subcategory_is":
    case "subcategory_is_not":
      return { type, subcategoryId: parseUuid("subcategoryId", raw.subcategoryId) };
    case "tag_is":
    case "tag_is_not":
      return { type, tagId: parseUuid("tagId", raw.tagId) };
    case "import_id_is":
      return { type, importId: parseUuid("importId", raw.importId) };
    default:
      throw new ValidationError("Invalid type.", { field: "type", value: type });
  }
}

function parseSetCategoryAction(raw: Record<string, unknown>): RuleAction {
  const categoryId = parseUuid("categoryId", raw.categoryId);
  const subcategoryId =
    raw.subcategoryId === null
      ? null
      : raw.subcategoryId === undefined
        ? null
        : parseUuid("subcategoryId", raw.subcategoryId);
  return { type: "set_category", categoryId, subcategoryId };
}

function parseSetTagsAction(raw: Record<string, unknown>): RuleAction {
  if (!Array.isArray(raw.tagIds)) {
    throw new ValidationError("Invalid tag ids.");
  }
  const seen = new Set<string>();
  const tagIds: string[] = [];
  for (const item of raw.tagIds) {
    const id = parseUuid("tagId", item);
    if (!seen.has(id)) {
      seen.add(id);
      tagIds.push(id);
    }
  }
  if (tagIds.length > 20) {
    throw new ValidationError("Invalid tag ids.");
  }
  return { type: "set_tags", tagIds };
}

function parseTextMutationAction(
  type: Extract<
    RuleActionType,
    "set_description" | "append_description" | "prepend_description" | "set_ref_no"
  >,
  raw: Record<string, unknown>
): RuleAction {
  return { type, value: parseNonEmptyString("value", raw.value, "Invalid action value.") };
}

function parseActionItem(raw: unknown): RuleAction {
  if (!isRecord(raw)) {
    throw new ValidationError("Invalid JSON.");
  }
  const type = parseActionType(raw.type);
  switch (type) {
    case "clear_category":
    case "clear_tags":
    case "clear_ref_no":
    case "delete_transaction":
      return { type };
    case "set_category":
      return parseSetCategoryAction(raw);
    case "add_tag":
    case "remove_tag":
      return { type, tagId: parseUuid("tagId", raw.tagId) };
    case "set_tags":
      return parseSetTagsAction(raw);
    case "set_description":
    case "append_description":
    case "prepend_description":
    case "set_ref_no":
      return parseTextMutationAction(type, raw);
    case "replace_in_description":
      return {
        type,
        find: parseNonEmptyString("find", raw.find, "Invalid action value."),
        replace: typeof raw.replace === "string" ? raw.replace.trim() : String(raw.replace ?? ""),
      };
    case "set_source_account":
    case "set_destination_account":
      return { type, accountId: parseUuid("accountId", raw.accountId) };
    case "set_source_system":
      return { type, accountType: parseSourceSystemType(raw.accountType) };
    case "set_destination_system":
      return { type, accountType: parseDestinationSystemType(raw.accountType) };
    default:
      throw new ValidationError("Invalid type.", { field: "type", value: type });
  }
}

function isGroup(value: Record<string, unknown>): boolean {
  return value.op === "and" || value.op === "or";
}

function parseWhenNode(input: unknown, depth: number, leaves: { count: number }): RuleExpression {
  if (!isRecord(input)) {
    throw new ValidationError("Invalid JSON.");
  }
  if (isGroup(input)) {
    if ("type" in input) {
      throw new ValidationError("Invalid JSON.");
    }
    if (depth > MAX_WHEN_DEPTH) {
      throw new ValidationError("Groups can only nest 4 levels deep.");
    }
    if (!Array.isArray(input.items)) {
      throw new ValidationError("Invalid JSON.");
    }
    if (input.items.length === 0) {
      throw new ValidationError("A group needs at least one condition.");
    }
    const op = input.op === "or" ? "or" : "and";
    return {
      op,
      items: input.items.map((item) => parseWhenNode(item, depth + 1, leaves)),
    };
  }
  const trigger = parseTriggerItem(input);
  leaves.count += 1;
  if (leaves.count > MAX_TRIGGERS_PER_RULE) {
    throw new ValidationError("Too many triggers.", { context: { max: MAX_TRIGGERS_PER_RULE } });
  }
  return trigger;
}

export function parseWhenJson(input: unknown): RuleExpression {
  if (Array.isArray(input)) {
    throw new ValidationError("Invalid JSON.");
  }
  return parseWhenNode(input, 1, { count: 0 });
}

export function parseActionsJson(input: unknown): RuleAction[] {
  if (!Array.isArray(input)) {
    throw new ValidationError("Invalid JSON.");
  }
  if (input.length > MAX_ACTIONS_PER_RULE) {
    throw new ValidationError("Too many actions.", { context: { max: MAX_ACTIONS_PER_RULE } });
  }
  return input.map((item) => parseActionItem(item));
}
