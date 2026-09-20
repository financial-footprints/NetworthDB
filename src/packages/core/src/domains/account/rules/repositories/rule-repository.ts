import type { TransactionRule } from "@core/domains/account/rules/entities/transaction-rule";
import type { Pagination, Sort } from "@core/shared/query";

export type RuleFilters = {
  id?: string;
  userId?: string;
  groupId?: string;
  active?: boolean;
};

export type RuleSortColumn = "sort_order";

export interface RuleRepository {
  create(rule: TransactionRule): Promise<TransactionRule>;
  save(rule: TransactionRule): Promise<TransactionRule>;
  delete(userId: string, ruleId: string): Promise<boolean>;
  deleteByGroup(userId: string, groupId: string): Promise<void>;
  findById(userId: string, ruleId: string): Promise<TransactionRule | null>;
  findByFilters(
    filters: RuleFilters,
    sort?: Sort<RuleSortColumn>,
    pagination?: Pagination
  ): Promise<TransactionRule[]>;
  aggregate(filters: RuleFilters): Promise<number>;
}
