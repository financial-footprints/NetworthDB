import type { TransactionRule } from "@core/domains/account/rules/entities/transaction-rule";
import type {
  RuleFilters,
  RuleRepository,
  RuleSortColumn,
} from "@core/domains/account/rules/repositories/rule-repository";
import type { Pagination, Sort } from "@core/shared/query";
import { paginate, sortByColumn } from "@core/tests/fakes/repository-helpers";

export class InMemoryRuleRepository implements RuleRepository {
  private readonly byId = new Map<string, TransactionRule>();

  async create(rule: TransactionRule): Promise<TransactionRule> {
    this.byId.set(rule.id, rule);
    return rule;
  }

  async save(rule: TransactionRule): Promise<TransactionRule> {
    this.byId.set(rule.id, rule);
    return rule;
  }

  async delete(userId: string, ruleId: string): Promise<boolean> {
    const existing = this.byId.get(ruleId);
    if (!existing || existing.userId !== userId) {
      return false;
    }
    this.byId.delete(ruleId);
    return true;
  }

  async deleteByGroup(userId: string, groupId: string): Promise<void> {
    for (const [id, row] of this.byId.entries()) {
      if (row.userId === userId && row.groupId === groupId) {
        this.byId.delete(id);
      }
    }
  }

  async findById(userId: string, ruleId: string): Promise<TransactionRule | null> {
    const row = this.byId.get(ruleId);
    if (!row || row.userId !== userId) {
      return null;
    }
    return row;
  }

  async findByFilters(
    filters: RuleFilters,
    sort?: Sort<RuleSortColumn>,
    pagination?: Pagination
  ): Promise<TransactionRule[]> {
    let items = [...this.byId.values()].filter((row) => this.matches(row, filters));
    items = sortByColumn(items, { sort_order: (row) => row.sortOrder }, sort);
    return paginate(items, pagination);
  }

  async aggregate(filters: RuleFilters): Promise<number> {
    return (await this.findByFilters(filters)).length;
  }

  private matches(row: TransactionRule, filters: RuleFilters): boolean {
    if (filters.id && row.id !== filters.id) {
      return false;
    }
    if (filters.userId && row.userId !== filters.userId) {
      return false;
    }
    if (filters.groupId && row.groupId !== filters.groupId) {
      return false;
    }
    if (filters.active !== undefined && row.active !== filters.active) {
      return false;
    }
    return true;
  }
}
