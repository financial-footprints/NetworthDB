import { parseActionsJson, parseWhenJson } from "@core/domains/account/rules/embedded";
import { applyPagination, applySort } from "@database/repositories/helpers";
import { transactionRules } from "@database/schema/transactions/rules";
import type { DbClient } from "@database/types";
import {
  type Pagination,
  type RuleFilters,
  type RuleRepository,
  type RuleSortColumn,
  type Sort,
  TransactionRule,
} from "@ndb/core";
import { and, asc, count, eq, type SQL } from "drizzle-orm";

function mapRule(row: typeof transactionRules.$inferSelect): TransactionRule {
  const when = parseWhenJson(row.triggers);
  const actions = parseActionsJson(row.actions);
  return new TransactionRule(
    row.id,
    row.userId,
    row.groupId,
    row.sortOrder,
    row.active,
    row.stopProcessing,
    row.runOnCreate,
    row.title,
    row.description,
    when,
    actions,
    row.createdAt.toISOString(),
    row.updatedAt.toISOString()
  );
}

function ruleValues(rule: TransactionRule) {
  return {
    id: rule.id,
    userId: rule.userId,
    groupId: rule.groupId,
    sortOrder: rule.sortOrder,
    active: rule.active,
    stopProcessing: rule.stopProcessing,
    runOnCreate: rule.runOnCreate,
    title: rule.title,
    description: rule.description,
    triggers: rule.when,
    actions: rule.actions,
    createdAt: new Date(rule.createdAt),
    updatedAt: new Date(rule.updatedAt),
  };
}

function ruleWhere(filters: RuleFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (filters.id) {
    parts.push(eq(transactionRules.id, filters.id));
  }
  if (filters.userId) {
    parts.push(eq(transactionRules.userId, filters.userId));
  }
  if (filters.groupId) {
    parts.push(eq(transactionRules.groupId, filters.groupId));
  }
  if (filters.active !== undefined) {
    parts.push(eq(transactionRules.active, filters.active));
  }
  return parts.length > 0 ? and(...parts) : undefined;
}

export class DrizzleRuleRepository implements RuleRepository {
  constructor(private readonly db: DbClient) {}

  async create(rule: TransactionRule): Promise<TransactionRule> {
    const rows = await this.db.insert(transactionRules).values(ruleValues(rule)).returning();
    const row = rows[0];
    if (!row) {
      throw new Error("database.rule.create.error.no-row");
    }
    return mapRule(row);
  }

  async save(rule: TransactionRule): Promise<TransactionRule> {
    const rows = await this.db
      .update(transactionRules)
      .set({
        sortOrder: rule.sortOrder,
        active: rule.active,
        stopProcessing: rule.stopProcessing,
        runOnCreate: rule.runOnCreate,
        title: rule.title,
        description: rule.description,
        triggers: rule.when,
        actions: rule.actions,
        updatedAt: new Date(rule.updatedAt),
      })
      .where(and(eq(transactionRules.id, rule.id), eq(transactionRules.userId, rule.userId)))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error("database.rule.save.error.no-row");
    }
    return mapRule(row);
  }

  async delete(userId: string, ruleId: string): Promise<boolean> {
    const rows = await this.db
      .delete(transactionRules)
      .where(and(eq(transactionRules.id, ruleId), eq(transactionRules.userId, userId)))
      .returning({ id: transactionRules.id });
    return rows.length > 0;
  }

  async deleteByGroup(userId: string, groupId: string): Promise<void> {
    await this.db
      .delete(transactionRules)
      .where(and(eq(transactionRules.userId, userId), eq(transactionRules.groupId, groupId)));
  }

  async findById(userId: string, ruleId: string): Promise<TransactionRule | null> {
    const rows = await this.db
      .select()
      .from(transactionRules)
      .where(and(eq(transactionRules.id, ruleId), eq(transactionRules.userId, userId)))
      .limit(1);
    const row = rows[0];
    return row ? mapRule(row) : null;
  }

  async findByFilters(
    filters: RuleFilters,
    sort?: Sort<RuleSortColumn>,
    pagination?: Pagination
  ): Promise<TransactionRule[]> {
    const where = ruleWhere(filters);
    let query = this.db.select().from(transactionRules);
    if (where) {
      query = query.where(where) as typeof query;
    }
    const order =
      applySort({ sort_order: transactionRules.sortOrder }, sort) ??
      asc(transactionRules.sortOrder);
    query = query.orderBy(
      order,
      asc(transactionRules.createdAt),
      asc(transactionRules.id)
    ) as typeof query;
    const rows = await applyPagination(query, pagination);
    return rows.map(mapRule);
  }

  async aggregate(filters: RuleFilters): Promise<number> {
    const where = ruleWhere(filters);
    let query = this.db.select({ value: count() }).from(transactionRules);
    if (where) {
      query = query.where(where) as typeof query;
    }
    const rows = await query;
    return Number(rows[0]?.value ?? 0);
  }
}
