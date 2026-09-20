import { applyPagination, applySort } from "@database/repositories/helpers";
import { transactionRuleGroups } from "@database/schema/transactions/rule-groups";
import type { DbClient } from "@database/types";
import {
  type Pagination,
  type RuleGroupFilters,
  type RuleGroupRepository,
  type RuleGroupSortColumn,
  type Sort,
  TransactionRuleGroup,
} from "@ndb/core";
import { and, asc, count, eq, type SQL } from "drizzle-orm";

function mapRuleGroup(row: typeof transactionRuleGroups.$inferSelect): TransactionRuleGroup {
  return new TransactionRuleGroup(
    row.id,
    row.userId,
    row.sortOrder,
    row.active,
    row.title,
    row.description,
    row.createdAt.toISOString(),
    row.updatedAt.toISOString()
  );
}

function ruleGroupValues(group: TransactionRuleGroup) {
  return {
    id: group.id,
    userId: group.userId,
    sortOrder: group.sortOrder,
    active: group.active,
    title: group.title,
    description: group.description,
    createdAt: new Date(group.createdAt),
    updatedAt: new Date(group.updatedAt),
  };
}

function ruleGroupWhere(filters: RuleGroupFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (filters.id) {
    parts.push(eq(transactionRuleGroups.id, filters.id));
  }
  if (filters.userId) {
    parts.push(eq(transactionRuleGroups.userId, filters.userId));
  }
  if (filters.active !== undefined) {
    parts.push(eq(transactionRuleGroups.active, filters.active));
  }
  return parts.length > 0 ? and(...parts) : undefined;
}

export class DrizzleRuleGroupRepository implements RuleGroupRepository {
  constructor(private readonly db: DbClient) {}

  async create(group: TransactionRuleGroup): Promise<TransactionRuleGroup> {
    const rows = await this.db
      .insert(transactionRuleGroups)
      .values(ruleGroupValues(group))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error("database.rule-group.create.error.no-row");
    }
    return mapRuleGroup(row);
  }

  async save(group: TransactionRuleGroup): Promise<TransactionRuleGroup> {
    const rows = await this.db
      .update(transactionRuleGroups)
      .set({
        sortOrder: group.sortOrder,
        active: group.active,
        title: group.title,
        description: group.description,
        updatedAt: new Date(group.updatedAt),
      })
      .where(
        and(eq(transactionRuleGroups.id, group.id), eq(transactionRuleGroups.userId, group.userId))
      )
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error("database.rule-group.save.error.no-row");
    }
    return mapRuleGroup(row);
  }

  async delete(userId: string, groupId: string): Promise<boolean> {
    const rows = await this.db
      .delete(transactionRuleGroups)
      .where(and(eq(transactionRuleGroups.id, groupId), eq(transactionRuleGroups.userId, userId)))
      .returning({ id: transactionRuleGroups.id });
    return rows.length > 0;
  }

  async findById(userId: string, groupId: string): Promise<TransactionRuleGroup | null> {
    const rows = await this.db
      .select()
      .from(transactionRuleGroups)
      .where(and(eq(transactionRuleGroups.id, groupId), eq(transactionRuleGroups.userId, userId)))
      .limit(1);
    const row = rows[0];
    return row ? mapRuleGroup(row) : null;
  }

  async findByFilters(
    filters: RuleGroupFilters,
    sort?: Sort<RuleGroupSortColumn>,
    pagination?: Pagination
  ): Promise<TransactionRuleGroup[]> {
    const where = ruleGroupWhere(filters);
    let query = this.db.select().from(transactionRuleGroups);
    if (where) {
      query = query.where(where) as typeof query;
    }
    const order =
      applySort({ sort_order: transactionRuleGroups.sortOrder }, sort) ??
      asc(transactionRuleGroups.sortOrder);
    query = query.orderBy(
      order,
      asc(transactionRuleGroups.createdAt),
      asc(transactionRuleGroups.id)
    ) as typeof query;
    const rows = await applyPagination(query, pagination);
    return rows.map(mapRuleGroup);
  }

  async aggregate(filters: RuleGroupFilters): Promise<number> {
    const where = ruleGroupWhere(filters);
    let query = this.db.select({ value: count() }).from(transactionRuleGroups);
    if (where) {
      query = query.where(where) as typeof query;
    }
    const rows = await query;
    return Number(rows[0]?.value ?? 0);
  }
}
