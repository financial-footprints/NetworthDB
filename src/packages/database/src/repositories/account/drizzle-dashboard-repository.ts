import { parallelize } from "@database/repositories/helpers";
import { accounts } from "@database/schema/accounts";
import { transactionCategories } from "@database/schema/transactions/categories";
import { transactions } from "@database/schema/transactions/transactions";
import type { DbClient } from "@database/types";
import {
  type DashboardRangeAggregates,
  type DashboardRepository,
  type DashboardSeriesPoint,
  type SeriesBucket,
  sortDashboardAccountAmounts,
  sortDashboardNamedAmounts,
} from "@ndb/core";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

const src = alias(accounts, "dashboard_source");
const dest = alias(accounts, "dashboard_dest");

function rangeWhere(userId: string, from?: string, to?: string) {
  const parts = [eq(transactions.userId, userId)];
  if (from) {
    parts.push(gte(transactions.date, from));
  }
  if (to) {
    parts.push(lte(transactions.date, to));
  }
  return and(...parts);
}

const spendSql = sql`(
  ${src.accountType} in ('bank', 'credit_card', 'loan', 'stocks', 'bonds', 'mutual_funds')
  and ${dest.accountType} in ('unknown', 'expense', 'tumbler')
)`;

const incomeSql = sql`(
  ${dest.accountType} in ('bank', 'credit_card', 'loan', 'stocks', 'bonds', 'mutual_funds')
  and ${src.accountType} in ('unknown', 'revenue', 'tumbler')
)`;

const transferSql = sql`(
  ${src.accountType} in ('bank', 'credit_card', 'loan', 'stocks', 'bonds', 'mutual_funds')
  and ${dest.accountType} in ('bank', 'credit_card', 'loan', 'stocks', 'bonds', 'mutual_funds')
)`;

function seriesTrunc(bucket: SeriesBucket) {
  if (bucket === "day") {
    return sql`date_trunc('day', ${transactions.date}::timestamp)::date`;
  }
  if (bucket === "week") {
    return sql`date_trunc('week', ${transactions.date}::timestamp)::date`;
  }
  return sql`date_trunc('month', ${transactions.date}::timestamp)::date`;
}

export class DrizzleDashboardRepository implements DashboardRepository {
  constructor(private readonly db: DbClient) {}

  async aggregateRange(
    userId: string,
    from: string | undefined,
    to: string | undefined,
    bucket: SeriesBucket
  ): Promise<DashboardRangeAggregates> {
    const where = rangeWhere(userId, from, to);

    const [
      cashflowRows,
      spendCategoryRows,
      spendSubcategoryRows,
      spendAccountRows,
      incomeCategoryRows,
      seriesRows,
    ] = await parallelize([
      () =>
        this.db
          .select({
            income: sql<number>`coalesce(sum(case when ${incomeSql} then ${transactions.amount} else 0 end), 0)`,
            spend: sql<number>`coalesce(sum(case when ${spendSql} then ${transactions.amount} else 0 end), 0)`,
            transfer: sql<number>`coalesce(sum(case when ${transferSql} then ${transactions.amount} else 0 end), 0)`,
            incomeCount: sql<number>`coalesce(sum(case when ${incomeSql} then 1 else 0 end), 0)`,
            spendCount: sql<number>`coalesce(sum(case when ${spendSql} then 1 else 0 end), 0)`,
            transferCount: sql<number>`coalesce(sum(case when ${transferSql} then 1 else 0 end), 0)`,
            uncategorizedSpend: sql<number>`coalesce(sum(case when ${spendSql} and ${transactions.categoryId} is null then ${transactions.amount} else 0 end), 0)`,
            uncategorizedSpendCount: sql<number>`coalesce(sum(case when ${spendSql} and ${transactions.categoryId} is null then 1 else 0 end), 0)`,
            unknownCounterpart: sql<number>`coalesce(sum(case when (${spendSql} and ${dest.accountType} = 'unknown') or (${incomeSql} and ${src.accountType} = 'unknown') then ${transactions.amount} else 0 end), 0)`,
            unknownCounterpartCount: sql<number>`coalesce(sum(case when (${spendSql} and ${dest.accountType} = 'unknown') or (${incomeSql} and ${src.accountType} = 'unknown') then 1 else 0 end), 0)`,
          })
          .from(transactions)
          .innerJoin(src, eq(transactions.sourceAccountId, src.id))
          .innerJoin(dest, eq(transactions.destinationAccountId, dest.id))
          .where(where),

      () =>
        this.db
          .select({
            id: transactions.categoryId,
            name: sql<string>`coalesce(${transactionCategories.name}, 'Uncategorized')`,
            amount: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
            txnCount: sql<number>`count(*)::int`,
          })
          .from(transactions)
          .innerJoin(src, eq(transactions.sourceAccountId, src.id))
          .innerJoin(dest, eq(transactions.destinationAccountId, dest.id))
          .leftJoin(transactionCategories, eq(transactions.categoryId, transactionCategories.id))
          .where(and(where, spendSql))
          .groupBy(transactions.categoryId, transactionCategories.name),

      () =>
        this.db
          .select({
            subId: transactions.subcategoryId,
            catId: transactions.categoryId,
            subName: sql<string>`coalesce(${transactionCategories.name}, 'No subcategory')`,
            amount: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
            txnCount: sql<number>`count(*)::int`,
          })
          .from(transactions)
          .innerJoin(src, eq(transactions.sourceAccountId, src.id))
          .innerJoin(dest, eq(transactions.destinationAccountId, dest.id))
          .leftJoin(transactionCategories, eq(transactions.subcategoryId, transactionCategories.id))
          .where(and(where, spendSql, sql`${transactions.categoryId} is not null`))
          .groupBy(transactions.subcategoryId, transactions.categoryId, transactionCategories.name),

      () =>
        this.db
          .select({
            accountId: transactions.sourceAccountId,
            label: src.label,
            accountType: src.accountType,
            amount: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
            txnCount: sql<number>`count(*)::int`,
          })
          .from(transactions)
          .innerJoin(src, eq(transactions.sourceAccountId, src.id))
          .innerJoin(dest, eq(transactions.destinationAccountId, dest.id))
          .where(and(where, spendSql))
          .groupBy(transactions.sourceAccountId, src.label, src.accountType),

      () =>
        this.db
          .select({
            id: transactions.categoryId,
            name: sql<string>`coalesce(${transactionCategories.name}, 'Uncategorized')`,
            amount: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
            txnCount: sql<number>`count(*)::int`,
          })
          .from(transactions)
          .innerJoin(src, eq(transactions.sourceAccountId, src.id))
          .innerJoin(dest, eq(transactions.destinationAccountId, dest.id))
          .leftJoin(transactionCategories, eq(transactions.categoryId, transactionCategories.id))
          .where(and(where, incomeSql))
          .groupBy(transactions.categoryId, transactionCategories.name),

      () =>
        this.db
          .select({
            bucketStart: sql<string>`${seriesTrunc(bucket)}`,
            income: sql<number>`coalesce(sum(case when ${incomeSql} then ${transactions.amount} else 0 end), 0)`,
            spend: sql<number>`coalesce(sum(case when ${spendSql} then ${transactions.amount} else 0 end), 0)`,
          })
          .from(transactions)
          .innerJoin(src, eq(transactions.sourceAccountId, src.id))
          .innerJoin(dest, eq(transactions.destinationAccountId, dest.id))
          .where(where)
          .groupBy(seriesTrunc(bucket))
          .orderBy(seriesTrunc(bucket)),
    ]);

    const cashflowRow = cashflowRows[0];
    const cashflow = {
      income: Number(cashflowRow?.income ?? 0),
      spend: Number(cashflowRow?.spend ?? 0),
      transfer: Number(cashflowRow?.transfer ?? 0),
      incomeCount: Number(cashflowRow?.incomeCount ?? 0),
      spendCount: Number(cashflowRow?.spendCount ?? 0),
      transferCount: Number(cashflowRow?.transferCount ?? 0),
      uncategorizedSpend: Number(cashflowRow?.uncategorizedSpend ?? 0),
      uncategorizedSpendCount: Number(cashflowRow?.uncategorizedSpendCount ?? 0),
      unknownCounterpart: Number(cashflowRow?.unknownCounterpart ?? 0),
      unknownCounterpartCount: Number(cashflowRow?.unknownCounterpartCount ?? 0),
    };

    const spendByCategory = sortDashboardNamedAmounts(
      spendCategoryRows.map((row) => ({
        id: row.id,
        name: row.name,
        parentId: null,
        amount: Number(row.amount),
        txnCount: Number(row.txnCount),
      }))
    );

    const spendBySubcategory = sortDashboardNamedAmounts(
      spendSubcategoryRows.map((row) => ({
        id: row.subId,
        name: row.subName,
        parentId: row.catId,
        amount: Number(row.amount),
        txnCount: Number(row.txnCount),
      }))
    );

    const spendByAccount = sortDashboardAccountAmounts(
      spendAccountRows.map((row) => ({
        accountId: row.accountId,
        label: row.label,
        accountType: row.accountType,
        amount: Number(row.amount),
        txnCount: Number(row.txnCount),
      }))
    );

    const incomeByCategory = sortDashboardNamedAmounts(
      incomeCategoryRows.map((row) => ({
        id: row.id,
        name: row.name,
        parentId: null,
        amount: Number(row.amount),
        txnCount: Number(row.txnCount),
      }))
    );

    const series: DashboardSeriesPoint[] = seriesRows.map((row) => ({
      bucketStart: String(row.bucketStart),
      income: Number(row.income),
      spend: Number(row.spend),
    }));

    return {
      cashflow,
      spendByCategory,
      spendBySubcategory,
      spendByAccount,
      incomeByCategory,
      series,
    };
  }
}
