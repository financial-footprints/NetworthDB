import type { TransactionRuleGroup } from "@core/domains/account/rules/entities/transaction-rule-group";
import type { Pagination, Sort } from "@core/shared/query";

export type RuleGroupFilters = {
  id?: string;
  userId?: string;
  active?: boolean;
};

export type RuleGroupSortColumn = "sort_order";

export interface RuleGroupRepository {
  create(group: TransactionRuleGroup): Promise<TransactionRuleGroup>;
  save(group: TransactionRuleGroup): Promise<TransactionRuleGroup>;
  delete(userId: string, groupId: string): Promise<boolean>;
  findById(userId: string, groupId: string): Promise<TransactionRuleGroup | null>;
  findByFilters(
    filters: RuleGroupFilters,
    sort?: Sort<RuleGroupSortColumn>,
    pagination?: Pagination
  ): Promise<TransactionRuleGroup[]>;
  aggregate(filters: RuleGroupFilters): Promise<number>;
}
