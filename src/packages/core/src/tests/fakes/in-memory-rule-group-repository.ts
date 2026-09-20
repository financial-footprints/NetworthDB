import type { TransactionRuleGroup } from "@core/domains/account/rules/entities/transaction-rule-group";
import type {
  RuleGroupFilters,
  RuleGroupRepository,
  RuleGroupSortColumn,
} from "@core/domains/account/rules/repositories/rule-group-repository";
import type { Pagination, Sort } from "@core/shared/query";
import { paginate, sortByColumn } from "@core/tests/fakes/repository-helpers";

export class InMemoryRuleGroupRepository implements RuleGroupRepository {
  private readonly byId = new Map<string, TransactionRuleGroup>();

  async create(group: TransactionRuleGroup): Promise<TransactionRuleGroup> {
    this.byId.set(group.id, group);
    return group;
  }

  async save(group: TransactionRuleGroup): Promise<TransactionRuleGroup> {
    this.byId.set(group.id, group);
    return group;
  }

  async delete(userId: string, groupId: string): Promise<boolean> {
    const existing = this.byId.get(groupId);
    if (!existing || existing.userId !== userId) {
      return false;
    }
    this.byId.delete(groupId);
    return true;
  }

  async findById(userId: string, groupId: string): Promise<TransactionRuleGroup | null> {
    const row = this.byId.get(groupId);
    if (!row || row.userId !== userId) {
      return null;
    }
    return row;
  }

  async findByFilters(
    filters: RuleGroupFilters,
    sort?: Sort<RuleGroupSortColumn>,
    pagination?: Pagination
  ): Promise<TransactionRuleGroup[]> {
    let items = [...this.byId.values()].filter((row) => this.matches(row, filters));
    items = sortByColumn(items, { sort_order: (row) => row.sortOrder }, sort);
    return paginate(items, pagination);
  }

  async aggregate(filters: RuleGroupFilters): Promise<number> {
    return (await this.findByFilters(filters)).length;
  }

  private matches(row: TransactionRuleGroup, filters: RuleGroupFilters): boolean {
    if (filters.id && row.id !== filters.id) {
      return false;
    }
    if (filters.userId && row.userId !== filters.userId) {
      return false;
    }
    if (filters.active !== undefined && row.active !== filters.active) {
      return false;
    }
    return true;
  }
}
