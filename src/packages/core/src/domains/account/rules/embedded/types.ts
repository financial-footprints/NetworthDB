import type { AccountType, SystemAccountType } from "@core/domains/account/constants";
import type { Account } from "@core/domains/account/entities/account";
import type { Category } from "@core/domains/account/taxonomy/entities/category";
import type { Tag } from "@core/domains/account/taxonomy/entities/tag";
import type { Transaction } from "@core/domains/account/transactions/entities/transaction";

export type SourceSystemAccountType = "unknown" | "revenue" | "tumbler";
export type DestinationSystemAccountType = "unknown" | "expense" | "tumbler";

export type RuleTrigger =
  | { type: "description_contains"; value: string }
  | { type: "description_not_contains"; value: string }
  | { type: "description_is"; value: string }
  | { type: "description_is_not"; value: string }
  | { type: "description_starts"; value: string }
  | { type: "description_ends"; value: string }
  | { type: "description_matches_regex"; value: string }
  | { type: "ref_contains"; value: string }
  | { type: "ref_not_contains"; value: string }
  | { type: "ref_is"; value: string }
  | { type: "ref_is_not"; value: string }
  | { type: "ref_starts"; value: string }
  | { type: "ref_ends"; value: string }
  | { type: "ref_matches_regex"; value: string }
  | { type: "ref_is_empty" }
  | { type: "ref_is_set" }
  | { type: "amount_exactly"; amount: number }
  | { type: "amount_not"; amount: number }
  | { type: "amount_less"; amount: number }
  | { type: "amount_less_or_equal"; amount: number }
  | { type: "amount_greater"; amount: number }
  | { type: "amount_greater_or_equal"; amount: number }
  | { type: "amount_between"; min: number; max: number }
  | { type: "date_is"; date: string }
  | { type: "date_is_not"; date: string }
  | { type: "date_before"; date: string }
  | { type: "date_after"; date: string }
  | { type: "date_on_or_before"; date: string }
  | { type: "date_on_or_after"; date: string }
  | { type: "date_between"; from: string; to: string }
  | { type: "date_weekday_is"; weekday: number }
  | { type: "date_month_is"; month: number }
  | { type: "source_account_is"; accountId: string }
  | { type: "source_account_is_not"; accountId: string }
  | { type: "destination_account_is"; accountId: string }
  | { type: "destination_account_is_not"; accountId: string }
  | { type: "either_account_is"; accountId: string }
  | { type: "either_account_is_not"; accountId: string }
  | { type: "source_account_type_is"; accountType: AccountType }
  | { type: "destination_account_type_is"; accountType: AccountType }
  | { type: "either_account_type_is"; accountType: AccountType }
  | { type: "source_is_system" }
  | { type: "destination_is_system" }
  | { type: "source_is_instrument" }
  | { type: "destination_is_instrument" }
  | { type: "pair_is_transfer" }
  | { type: "pair_is_spend" }
  | { type: "pair_is_income" }
  | { type: "category_is"; categoryId: string }
  | { type: "category_is_not"; categoryId: string }
  | { type: "has_category" }
  | { type: "has_no_category" }
  | { type: "subcategory_is"; subcategoryId: string }
  | { type: "subcategory_is_not"; subcategoryId: string }
  | { type: "tag_is"; tagId: string }
  | { type: "tag_is_not"; tagId: string }
  | { type: "has_no_tags" }
  | { type: "has_any_tag" }
  | { type: "has_import" }
  | { type: "has_no_import" }
  | { type: "import_id_is"; importId: string };

export type RuleExpression =
  | { op: "and"; items: RuleExpression[] }
  | { op: "or"; items: RuleExpression[] }
  | RuleTrigger;

export type RuleAction =
  | { type: "set_category"; categoryId: string; subcategoryId: string | null }
  | { type: "clear_category" }
  | { type: "add_tag"; tagId: string }
  | { type: "remove_tag"; tagId: string }
  | { type: "clear_tags" }
  | { type: "set_tags"; tagIds: string[] }
  | { type: "set_description"; value: string }
  | { type: "append_description"; value: string }
  | { type: "prepend_description"; value: string }
  | { type: "replace_in_description"; find: string; replace: string }
  | { type: "set_ref_no"; value: string }
  | { type: "clear_ref_no" }
  | { type: "set_source_account"; accountId: string }
  | { type: "set_destination_account"; accountId: string }
  | { type: "set_source_system"; accountType: SourceSystemAccountType }
  | { type: "set_destination_system"; accountType: DestinationSystemAccountType }
  | { type: "delete_transaction" };

export type RuleEvalContext = {
  source: Account;
  dest: Account;
  accountsById: Map<string, Account>;
  categoriesById: Map<string, Category>;
  tagsById: Map<string, Tag>;
  systemByType: Partial<Record<SystemAccountType, Account>>;
};

export type ApplyActionsResult = {
  transaction: Transaction;
  deleted: boolean;
  warnings: string[];
};

export type WalkRulesResult = {
  transaction: Transaction;
  deleted: boolean;
  warnings: string[];
  stopped: boolean;
  matched: boolean;
};
