import { applyPagination, applySort, escapeLikePattern } from "@database/repositories/helpers";
import { transactionImports } from "@database/schema/transactions/imports";
import { transactionsMonthlySummary } from "@database/schema/transactions/monthly-summary";
import { transactionTagAssignments } from "@database/schema/transactions/tags";
import { transactions } from "@database/schema/transactions/transactions";
import type { DbClient } from "@database/types";
import {
  type AmountAggregate,
  type MonthlySummary,
  type OwnedId,
  type Pagination,
  type Sort,
  Transaction,
  type TransactionCursor,
  type TransactionFilters,
  TransactionImport,
  type TransactionRepository,
  type TransactionSortColumn,
} from "@ndb/core";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lte,
  max,
  min,
  or,
  type SQL,
  sql,
} from "drizzle-orm";

function mapTransaction(row: typeof transactions.$inferSelect, tagIds: string[]): Transaction {
  return new Transaction(
    row.id,
    row.userId,
    row.date,
    row.amount,
    row.sourceAccountId,
    row.destinationAccountId,
    row.description,
    row.refNo,
    row.importId,
    row.categoryId,
    row.subcategoryId,
    tagIds,
    row.createdAt.toISOString(),
    row.updatedAt.toISOString()
  );
}

function mapImport(row: typeof transactionImports.$inferSelect): TransactionImport {
  return new TransactionImport(row.id, row.userId, row.accountId, row.createdAt.toISOString());
}

function mapSummary(row: typeof transactionsMonthlySummary.$inferSelect): MonthlySummary {
  return {
    id: row.id,
    userId: row.userId,
    accountId: row.accountId,
    year: row.year,
    month: row.month,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    amountCredit: row.amountCredit,
    amountDebit: row.amountDebit,
    amountOpening: row.amountOpening,
    amountClosing: row.amountClosing,
    txnCount: row.txnCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function transactionValues(transaction: Transaction) {
  return {
    id: transaction.id,
    userId: transaction.userId,
    date: transaction.date,
    amount: transaction.amount,
    sourceAccountId: transaction.sourceAccountId,
    destinationAccountId: transaction.destinationAccountId,
    categoryId: transaction.categoryId,
    subcategoryId: transaction.subcategoryId,
    description: transaction.description,
    refNo: transaction.refNo,
    importId: transaction.importId,
    createdAt: new Date(transaction.createdAt),
    updatedAt: new Date(transaction.updatedAt),
  };
}

function pushIdentityFilters(parts: SQL[], filters: TransactionFilters): void {
  if (filters.id) {
    parts.push(eq(transactions.id, filters.id));
  }
  if (filters.userId) {
    parts.push(eq(transactions.userId, filters.userId));
  }
  if (filters.importId) {
    parts.push(eq(transactions.importId, filters.importId));
  }
  if (filters.categoryId) {
    parts.push(eq(transactions.categoryId, filters.categoryId));
  }
  if (filters.subcategoryId) {
    parts.push(eq(transactions.subcategoryId, filters.subcategoryId));
  }
}

function pushDateFilters(parts: SQL[], filters: TransactionFilters): void {
  if (filters.from) {
    parts.push(gte(transactions.date, filters.from));
  }
  if (filters.to) {
    parts.push(lte(transactions.date, filters.to));
  }
  if (filters.onOrBefore) {
    parts.push(lte(transactions.date, filters.onOrBefore));
  }
  if (filters.after) {
    parts.push(gt(transactions.date, filters.after));
  }
}

function pushAccountFilters(parts: SQL[], filters: TransactionFilters): void {
  if (filters.accountId) {
    parts.push(
      or(
        eq(transactions.sourceAccountId, filters.accountId),
        eq(transactions.destinationAccountId, filters.accountId)
      ) as SQL
    );
  }
  if (filters.sourceAccountId) {
    parts.push(eq(transactions.sourceAccountId, filters.sourceAccountId));
  }
  if (filters.destinationAccountId) {
    parts.push(eq(transactions.destinationAccountId, filters.destinationAccountId));
  }
  if (filters.tagId) {
    parts.push(
      sql`exists (
        select 1 from ${transactionTagAssignments}
        where ${transactionTagAssignments.transactionId} = ${transactions.id}
        and ${transactionTagAssignments.tagId} = ${filters.tagId}
      )`
    );
  }
}

function pushAmountFilters(parts: SQL[], filters: TransactionFilters): void {
  if (filters.amountMin !== undefined) {
    parts.push(gte(transactions.amount, filters.amountMin));
  }
  if (filters.amountMax !== undefined) {
    parts.push(lte(transactions.amount, filters.amountMax));
  }
  if (filters.word) {
    const needle = filters.word.trim().toLowerCase();
    if (needle.length > 0) {
      const pattern = `%${escapeLikePattern(needle)}%`;
      parts.push(sql`lower(${transactions.description}) like ${pattern} escape '\\'`);
    }
  }
}

function transactionWhere(filters: TransactionFilters): SQL | undefined {
  const parts: SQL[] = [];
  pushIdentityFilters(parts, filters);
  pushDateFilters(parts, filters);
  pushAccountFilters(parts, filters);
  pushAmountFilters(parts, filters);
  return parts.length > 0 ? and(...parts) : undefined;
}

async function loadTagIdsByTransactionIds(
  db: DbClient,
  transactionIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (transactionIds.length === 0) {
    return result;
  }
  const rows = await db
    .select()
    .from(transactionTagAssignments)
    .where(inArray(transactionTagAssignments.transactionId, transactionIds));
  for (const row of rows) {
    const existing = result.get(row.transactionId) ?? [];
    existing.push(row.tagId);
    result.set(row.transactionId, existing);
  }
  return result;
}

async function replaceAssignments(
  db: DbClient,
  transactionId: string,
  tagIds: string[]
): Promise<void> {
  await db
    .delete(transactionTagAssignments)
    .where(eq(transactionTagAssignments.transactionId, transactionId));
  if (tagIds.length === 0) {
    return;
  }
  await db.insert(transactionTagAssignments).values(
    tagIds.map((tagId) => ({
      transactionId,
      tagId,
    }))
  );
}

export class DrizzleTransactionRepository implements TransactionRepository {
  constructor(private readonly db: DbClient) {}

  async createImport(importRow: TransactionImport): Promise<TransactionImport> {
    const rows = await this.db
      .insert(transactionImports)
      .values({
        id: importRow.id,
        userId: importRow.userId,
        accountId: importRow.accountId,
        createdAt: new Date(importRow.createdAt),
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error("database.transaction-imports.create.error.no-row");
    }
    return mapImport(row);
  }

  async deleteImport(userId: string, accountId: string, importId: string): Promise<boolean> {
    const rows = await this.db
      .delete(transactionImports)
      .where(
        and(
          eq(transactionImports.id, importId),
          eq(transactionImports.userId, userId),
          eq(transactionImports.accountId, accountId)
        )
      )
      .returning({ id: transactionImports.id });
    return rows.length > 0;
  }

  async create(transaction: Transaction): Promise<Transaction> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.insert(transactions).values(transactionValues(transaction)).returning();
      const row = rows[0];
      if (!row) {
        throw new Error("database.transactions.create.error.no-row");
      }
      await replaceAssignments(tx, transaction.id, transaction.tagIds);
      const tagMap = await loadTagIdsByTransactionIds(tx, [transaction.id]);
      return mapTransaction(row, tagMap.get(transaction.id) ?? []);
    });
  }

  async createMany(rows: Transaction[]): Promise<Transaction[]> {
    if (rows.length === 0) {
      return [];
    }
    return this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(transactions)
        .values(rows.map(transactionValues))
        .returning();
      for (const txn of rows) {
        await replaceAssignments(tx, txn.id, txn.tagIds);
      }
      const tagMap = await loadTagIdsByTransactionIds(
        tx,
        rows.map((row) => row.id)
      );
      return inserted.map((row) => mapTransaction(row, tagMap.get(row.id) ?? []));
    });
  }

  async findByIds(userId: string, ids: string[]): Promise<Transaction[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return [];
    }
    const rows = await this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, unique)));
    const tagMap = await loadTagIdsByTransactionIds(
      this.db,
      rows.map((row) => row.id)
    );
    return rows.map((row) => mapTransaction(row, tagMap.get(row.id) ?? []));
  }

  async saveMany(rowsIn: Transaction[]): Promise<Transaction[]> {
    if (rowsIn.length === 0) {
      return [];
    }
    return this.db.transaction(async (tx) => {
      const saved: Transaction[] = [];
      for (const transaction of rowsIn) {
        const rows = await tx
          .update(transactions)
          .set({
            date: transaction.date,
            amount: transaction.amount,
            sourceAccountId: transaction.sourceAccountId,
            destinationAccountId: transaction.destinationAccountId,
            categoryId: transaction.categoryId,
            subcategoryId: transaction.subcategoryId,
            description: transaction.description,
            refNo: transaction.refNo,
            updatedAt: new Date(transaction.updatedAt),
          })
          .where(
            and(eq(transactions.id, transaction.id), eq(transactions.userId, transaction.userId))
          )
          .returning();
        const row = rows[0];
        if (!row) {
          throw new Error("database.transactions.save.error.no-row");
        }
        await replaceAssignments(tx, transaction.id, transaction.tagIds);
        saved.push(mapTransaction(row, transaction.tagIds));
      }
      return saved;
    });
  }

  async save(transaction: Transaction): Promise<Transaction> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(transactions)
        .set({
          date: transaction.date,
          amount: transaction.amount,
          sourceAccountId: transaction.sourceAccountId,
          destinationAccountId: transaction.destinationAccountId,
          categoryId: transaction.categoryId,
          subcategoryId: transaction.subcategoryId,
          description: transaction.description,
          refNo: transaction.refNo,
          updatedAt: new Date(transaction.updatedAt),
        })
        .where(
          and(eq(transactions.id, transaction.id), eq(transactions.userId, transaction.userId))
        )
        .returning();
      const row = rows[0];
      if (!row) {
        throw new Error("database.transactions.save.error.no-row");
      }
      await replaceAssignments(tx, transaction.id, transaction.tagIds);
      return mapTransaction(row, transaction.tagIds);
    });
  }

  async deleteMany(userId: string, ids: string[]): Promise<number> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return 0;
    }
    const rows = await this.db
      .delete(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, unique)))
      .returning({ id: transactions.id });
    return rows.length;
  }

  async delete(userId: string, transactionId: string): Promise<boolean> {
    const rows = await this.db
      .delete(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
      .returning({ id: transactions.id });
    return rows.length > 0;
  }

  async findById(userId: string, transactionId: string): Promise<Transaction | null> {
    const rows = await this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return null;
    }
    const tagMap = await loadTagIdsByTransactionIds(this.db, [row.id]);
    return mapTransaction(row, tagMap.get(row.id) ?? []);
  }

  async findByFilters(
    filters: TransactionFilters,
    sort?: Sort<TransactionSortColumn>,
    pagination?: Pagination
  ): Promise<Transaction[]> {
    const where = transactionWhere(filters);
    let query = this.db.select().from(transactions);
    if (where) {
      query = query.where(where) as typeof query;
    }
    const direction = sort?.direction ?? "desc";
    const order = applySort({ date: transactions.date }, sort) ?? desc(transactions.date);
    const createdOrder =
      direction === "desc" ? desc(transactions.createdAt) : asc(transactions.createdAt);
    const idOrder = direction === "desc" ? desc(transactions.id) : asc(transactions.id);
    query = query.orderBy(order, createdOrder, idOrder) as typeof query;
    const rows = await applyPagination(query, pagination);
    const tagMap = await loadTagIdsByTransactionIds(
      this.db,
      rows.map((row) => row.id)
    );
    return rows.map((row) => mapTransaction(row, tagMap.get(row.id) ?? []));
  }

  async aggregate(filters: TransactionFilters): Promise<number> {
    const where = transactionWhere(filters);
    let query = this.db.select({ value: count() }).from(transactions);
    if (where) {
      query = query.where(where) as typeof query;
    }
    const rows = await query;
    return Number(rows[0]?.value ?? 0);
  }

  async getDateExtent(
    filters: Pick<TransactionFilters, "userId" | "accountId">
  ): Promise<{ min: string | null; max: string | null }> {
    const where = transactionWhere({
      userId: filters.userId,
      accountId: filters.accountId,
    });
    let query = this.db
      .select({
        minDate: min(transactions.date),
        maxDate: max(transactions.date),
      })
      .from(transactions);
    if (where) {
      query = query.where(where) as typeof query;
    }
    const rows = await query;
    const row = rows[0];
    const minDate = row?.minDate;
    const maxDate = row?.maxDate;
    return {
      min: minDate ? String(minDate) : null,
      max: maxDate ? String(maxDate) : null,
    };
  }

  async sumAmounts(filters: TransactionFilters): Promise<AmountAggregate> {
    const where = transactionWhere(filters);
    const accountId = filters.accountId;
    let query = this.db
      .select({
        credit: accountId
          ? sql<number>`coalesce(sum(case when ${transactions.destinationAccountId} = ${accountId} then ${transactions.amount} else 0 end), 0)`
          : sql<number>`0`,
        debit: accountId
          ? sql<number>`coalesce(sum(case when ${transactions.sourceAccountId} = ${accountId} then ${transactions.amount} else 0 end), 0)`
          : sql<number>`0`,
        txnCount: count(),
      })
      .from(transactions);
    if (where) {
      query = query.where(where) as typeof query;
    }
    const rows = await query;
    const row = rows[0];
    return {
      amountCredit: Number(row?.credit ?? 0),
      amountDebit: Number(row?.debit ?? 0),
      txnCount: Number(row?.txnCount ?? 0),
    };
  }

  async listMonthlySummaries(
    userId: string,
    accountId: string,
    onOrBeforePeriodEnd?: string
  ): Promise<MonthlySummary[]> {
    const parts = [
      eq(transactionsMonthlySummary.userId, userId),
      eq(transactionsMonthlySummary.accountId, accountId),
    ];
    if (onOrBeforePeriodEnd) {
      parts.push(lte(transactionsMonthlySummary.periodEnd, onOrBeforePeriodEnd));
    }
    const rows = await this.db
      .select()
      .from(transactionsMonthlySummary)
      .where(and(...parts))
      .orderBy(asc(transactionsMonthlySummary.year), asc(transactionsMonthlySummary.month));
    return rows.map(mapSummary);
  }

  async latestMonthlySummaryBefore(
    userId: string,
    accountId: string,
    onOrBefore: string
  ): Promise<MonthlySummary | null> {
    const rows = await this.db
      .select()
      .from(transactionsMonthlySummary)
      .where(
        and(
          eq(transactionsMonthlySummary.userId, userId),
          eq(transactionsMonthlySummary.accountId, accountId),
          lte(transactionsMonthlySummary.periodEnd, onOrBefore)
        )
      )
      .orderBy(desc(transactionsMonthlySummary.year), desc(transactionsMonthlySummary.month))
      .limit(1);
    const row = rows[0];
    return row ? mapSummary(row) : null;
  }

  async deleteMonthlySummariesFrom(
    userId: string,
    accountId: string,
    year: number,
    month: number
  ): Promise<void> {
    await this.db
      .delete(transactionsMonthlySummary)
      .where(
        and(
          eq(transactionsMonthlySummary.userId, userId),
          eq(transactionsMonthlySummary.accountId, accountId),
          or(
            gt(transactionsMonthlySummary.year, year),
            and(
              eq(transactionsMonthlySummary.year, year),
              gte(transactionsMonthlySummary.month, month)
            )
          )
        )
      );
  }

  async replaceMonthlySummaries(
    userId: string,
    accountId: string,
    rows: MonthlySummary[]
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    await this.db.insert(transactionsMonthlySummary).values(
      rows.map((row) => ({
        id: row.id,
        userId,
        accountId,
        year: row.year,
        month: row.month,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        amountCredit: row.amountCredit,
        amountDebit: row.amountDebit,
        amountOpening: row.amountOpening,
        amountClosing: row.amountClosing,
        txnCount: row.txnCount,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      }))
    );
  }

  async listImports(userId: string): Promise<TransactionImport[]> {
    const rows = await this.db
      .select()
      .from(transactionImports)
      .where(eq(transactionImports.userId, userId));
    return rows.map(mapImport);
  }

  async listByUserCursor(
    userId: string,
    after: TransactionCursor | null,
    limit: number
  ): Promise<Transaction[]> {
    const conditions: SQL[] = [eq(transactions.userId, userId)];
    if (after) {
      conditions.push(
        or(
          gt(transactions.date, after.date),
          and(
            eq(transactions.date, after.date),
            gt(transactions.createdAt, new Date(after.createdAt))
          ),
          and(
            eq(transactions.date, after.date),
            eq(transactions.createdAt, new Date(after.createdAt)),
            gt(transactions.id, after.id)
          )
        ) as SQL
      );
    }

    const rows = await this.db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(asc(transactions.date), asc(transactions.createdAt), asc(transactions.id))
      .limit(limit);

    const tagMap = await loadTagIdsByTransactionIds(
      this.db,
      rows.map((row) => row.id)
    );
    return rows.map((row) => mapTransaction(row, tagMap.get(row.id) ?? []));
  }

  async listByFiltersCursor(
    filters: TransactionFilters,
    after: TransactionCursor | null,
    limit: number
  ): Promise<Transaction[]> {
    const filterWhere = transactionWhere(filters);
    const conditions: SQL[] = [];
    if (filterWhere) {
      conditions.push(filterWhere);
    }
    if (after) {
      conditions.push(
        or(
          gt(transactions.date, after.date),
          and(
            eq(transactions.date, after.date),
            gt(transactions.createdAt, new Date(after.createdAt))
          ),
          and(
            eq(transactions.date, after.date),
            eq(transactions.createdAt, new Date(after.createdAt)),
            gt(transactions.id, after.id)
          )
        ) as SQL
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select()
      .from(transactions)
      .where(where)
      .orderBy(asc(transactions.date), asc(transactions.createdAt), asc(transactions.id))
      .limit(limit);

    const tagMap = await loadTagIdsByTransactionIds(
      this.db,
      rows.map((row) => row.id)
    );
    return rows.map((row) => mapTransaction(row, tagMap.get(row.id) ?? []));
  }

  async findImportIds(ids: string[]): Promise<OwnedId[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db
      .select({ id: transactionImports.id, userId: transactionImports.userId })
      .from(transactionImports)
      .where(inArray(transactionImports.id, ids));
    return rows;
  }

  async findTransactionIds(ids: string[]): Promise<OwnedId[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db
      .select({ id: transactions.id, userId: transactions.userId })
      .from(transactions)
      .where(inArray(transactions.id, ids));
    return rows;
  }
}
