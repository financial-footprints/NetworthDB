import type { MonthlySummary } from "@core/domains/account/transactions/entities/monthly-summary";
import type { Transaction } from "@core/domains/account/transactions/entities/transaction";
import type { TransactionImport } from "@core/domains/account/transactions/entities/transaction-import";
import type {
  AmountAggregate,
  OwnedId,
  TransactionCursor,
  TransactionFilters,
  TransactionRepository,
  TransactionSortColumn,
} from "@core/domains/account/transactions/repositories/transaction-repository";
import type { Pagination, Sort } from "@core/shared/query";
import { Time } from "@core/shared/time";
import { paginate } from "@core/tests/fakes/repository-helpers";

/** Mirrors DB-wide transaction id uniqueness for backup import tests. */
const globalTransactionOwners = new Map<string, string>();

function registerTransactionOwner(transaction: Transaction): void {
  globalTransactionOwners.set(transaction.id, transaction.userId);
}

function unregisterTransactionOwner(transactionId: string): void {
  globalTransactionOwners.delete(transactionId);
}

export class InMemoryTransactionRepository implements TransactionRepository {
  private readonly imports = new Map<string, TransactionImport>();
  private readonly transactions = new Map<string, Transaction>();
  private readonly summaries = new Map<string, MonthlySummary>();

  private summaryKey(accountId: string, year: number, month: number): string {
    return `${accountId}:${year}:${month}`;
  }

  async createImport(importRow: TransactionImport): Promise<TransactionImport> {
    this.imports.set(importRow.id, importRow);
    return importRow;
  }

  async deleteImport(userId: string, accountId: string, importId: string): Promise<boolean> {
    const row = this.imports.get(importId);
    if (!row || row.userId !== userId || row.accountId !== accountId) {
      return false;
    }
    this.imports.delete(importId);
    for (const [id, txn] of this.transactions.entries()) {
      if (txn.importId === importId) {
        this.transactions.delete(id);
        unregisterTransactionOwner(id);
      }
    }
    return true;
  }

  async create(transaction: Transaction): Promise<Transaction> {
    this.transactions.set(transaction.id, transaction);
    registerTransactionOwner(transaction);
    return transaction;
  }

  async createMany(rows: Transaction[]): Promise<Transaction[]> {
    for (const row of rows) {
      this.transactions.set(row.id, row);
      registerTransactionOwner(row);
    }
    return rows;
  }

  async save(transaction: Transaction): Promise<Transaction> {
    this.transactions.set(transaction.id, transaction);
    registerTransactionOwner(transaction);
    return transaction;
  }

  async saveMany(rows: Transaction[]): Promise<Transaction[]> {
    for (const row of rows) {
      await this.save(row);
    }
    return rows;
  }

  async deleteMany(userId: string, ids: string[]): Promise<number> {
    let deleted = 0;
    for (const id of [...new Set(ids)]) {
      if (await this.delete(userId, id)) {
        deleted += 1;
      }
    }
    return deleted;
  }

  async delete(userId: string, transactionId: string): Promise<boolean> {
    const txn = this.transactions.get(transactionId);
    if (!txn || txn.userId !== userId) {
      return false;
    }
    this.transactions.delete(transactionId);
    unregisterTransactionOwner(transactionId);
    return true;
  }

  async findById(userId: string, transactionId: string): Promise<Transaction | null> {
    const txn = this.transactions.get(transactionId);
    if (!txn || txn.userId !== userId) {
      return null;
    }
    return txn;
  }

  async findByIds(userId: string, ids: string[]): Promise<Transaction[]> {
    const found: Transaction[] = [];
    for (const id of ids) {
      const txn = await this.findById(userId, id);
      if (txn) {
        found.push(txn);
      }
    }
    return found;
  }

  async findByFilters(
    filters: TransactionFilters,
    sort?: Sort<TransactionSortColumn>,
    pagination?: Pagination
  ): Promise<Transaction[]> {
    const items = [...this.transactions.values()].filter((txn) => this.matches(txn, filters));
    const direction = sort?.direction ?? "desc";
    items.sort((a, b) => {
      const dateCmp = Time.compareIsoDates(a.date, b.date);
      if (dateCmp !== 0) {
        return direction === "desc" ? -dateCmp : dateCmp;
      }
      const createdCmp = a.createdAt.localeCompare(b.createdAt);
      if (createdCmp !== 0) {
        return direction === "desc" ? -createdCmp : createdCmp;
      }
      const idCmp = a.id.localeCompare(b.id);
      return direction === "desc" ? -idCmp : idCmp;
    });
    return paginate(items, pagination);
  }

  async aggregate(filters: TransactionFilters): Promise<number> {
    return (await this.findByFilters(filters)).length;
  }

  async getDateExtent(
    filters: Pick<TransactionFilters, "userId" | "accountId">
  ): Promise<{ min: string | null; max: string | null }> {
    const items = await this.findByFilters({
      userId: filters.userId,
      accountId: filters.accountId,
    });
    if (items.length === 0) {
      return { min: null, max: null };
    }
    let minDate = items[0].date;
    let maxDate = items[0].date;
    for (const txn of items) {
      if (Time.compareIsoDates(txn.date, minDate) < 0) {
        minDate = txn.date;
      }
      if (Time.compareIsoDates(txn.date, maxDate) > 0) {
        maxDate = txn.date;
      }
    }
    return { min: minDate, max: maxDate };
  }

  async sumAmounts(filters: TransactionFilters): Promise<AmountAggregate> {
    const items = await this.findByFilters(filters);
    const accountId = filters.accountId;
    let credit = 0;
    let debit = 0;
    for (const txn of items) {
      if (!accountId) {
        continue;
      }
      if (txn.destinationAccountId === accountId) {
        credit += txn.amount;
      }
      if (txn.sourceAccountId === accountId) {
        debit += txn.amount;
      }
    }
    return { amountCredit: credit, amountDebit: debit, txnCount: items.length };
  }

  async listMonthlySummaries(
    userId: string,
    accountId: string,
    onOrBeforePeriodEnd?: string
  ): Promise<MonthlySummary[]> {
    return [...this.summaries.values()]
      .filter((row) => row.userId === userId && row.accountId === accountId)
      .filter((row) =>
        onOrBeforePeriodEnd ? Time.compareIsoDates(row.periodEnd, onOrBeforePeriodEnd) <= 0 : true
      )
      .sort((a, b) => a.year - b.year || a.month - b.month);
  }

  async latestMonthlySummaryBefore(
    userId: string,
    accountId: string,
    onOrBefore: string
  ): Promise<MonthlySummary | null> {
    const rows = await this.listMonthlySummaries(userId, accountId, onOrBefore);
    return rows.at(-1) ?? null;
  }

  async deleteMonthlySummariesFrom(
    userId: string,
    accountId: string,
    year: number,
    month: number
  ): Promise<void> {
    for (const [key, row] of this.summaries.entries()) {
      if (row.userId !== userId || row.accountId !== accountId) {
        continue;
      }
      if (row.year > year || (row.year === year && row.month >= month)) {
        this.summaries.delete(key);
      }
    }
  }

  async replaceMonthlySummaries(
    _userId: string,
    accountId: string,
    rows: MonthlySummary[]
  ): Promise<void> {
    for (const row of rows) {
      this.summaries.set(this.summaryKey(accountId, row.year, row.month), row);
    }
  }

  async listImports(userId: string): Promise<TransactionImport[]> {
    return [...this.imports.values()].filter((row) => row.userId === userId);
  }

  async listByUserCursor(
    userId: string,
    after: TransactionCursor | null,
    limit: number
  ): Promise<Transaction[]> {
    const sorted = [...this.transactions.values()]
      .filter((txn) => txn.userId === userId)
      .sort((a, b) => this.compareTransactionOrder(a, b));

    const page = after === null ? sorted : sorted.filter((txn) => this.isAfterCursor(txn, after));
    return page.slice(0, limit);
  }

  async listByFiltersCursor(
    filters: TransactionFilters,
    after: TransactionCursor | null,
    limit: number
  ): Promise<Transaction[]> {
    const sorted = [...this.transactions.values()]
      .filter((txn) => this.matches(txn, filters))
      .sort((a, b) => this.compareTransactionOrder(a, b));

    const page = after === null ? sorted : sorted.filter((txn) => this.isAfterCursor(txn, after));
    return page.slice(0, limit);
  }

  async findImportIds(ids: string[]): Promise<OwnedId[]> {
    const idSet = new Set(ids);
    return [...this.imports.values()]
      .filter((row) => idSet.has(row.id))
      .map((row) => ({ id: row.id, userId: row.userId }));
  }

  async findTransactionIds(ids: string[]): Promise<OwnedId[]> {
    if (ids.length === 0) {
      return [];
    }
    const idSet = new Set(ids);
    const owned: OwnedId[] = [];
    for (const id of idSet) {
      const userId = globalTransactionOwners.get(id);
      if (userId !== undefined) {
        owned.push({ id, userId });
      }
    }
    return owned;
  }

  private compareTransactionOrder(a: Transaction, b: Transaction): number {
    if (a.date !== b.date) {
      return a.date < b.date ? -1 : 1;
    }
    if (a.createdAt !== b.createdAt) {
      return a.createdAt < b.createdAt ? -1 : 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }

  private isAfterCursor(txn: Transaction, after: TransactionCursor): boolean {
    if (txn.date !== after.date) {
      return txn.date > after.date;
    }
    if (txn.createdAt !== after.createdAt) {
      return txn.createdAt > after.createdAt;
    }
    return txn.id > after.id;
  }

  private matches(txn: Transaction, filters: TransactionFilters): boolean {
    if (filters.id && txn.id !== filters.id) {
      return false;
    }
    if (filters.userId && txn.userId !== filters.userId) {
      return false;
    }
    if (filters.accountId && !txn.involvesAccount(filters.accountId)) {
      return false;
    }
    if (filters.importId && txn.importId !== filters.importId) {
      return false;
    }
    if (!this.matchesDateRange(txn, filters)) {
      return false;
    }
    if (!this.matchesAmount(txn, filters)) {
      return false;
    }
    if (!this.matchesWord(txn, filters.word)) {
      return false;
    }
    return this.matchesTaxonomy(txn, filters);
  }

  private matchesAmount(txn: Transaction, filters: TransactionFilters): boolean {
    if (filters.amountMin !== undefined && txn.amount < filters.amountMin) {
      return false;
    }
    if (filters.amountMax !== undefined && txn.amount > filters.amountMax) {
      return false;
    }
    return true;
  }

  private matchesTaxonomy(txn: Transaction, filters: TransactionFilters): boolean {
    if (filters.categoryId && txn.categoryId !== filters.categoryId) {
      return false;
    }
    if (filters.subcategoryId && txn.subcategoryId !== filters.subcategoryId) {
      return false;
    }
    if (filters.tagId && !txn.tagIds.includes(filters.tagId)) {
      return false;
    }
    return true;
  }

  private matchesDateRange(txn: Transaction, filters: TransactionFilters): boolean {
    if (filters.from && Time.compareIsoDates(txn.date, filters.from) < 0) {
      return false;
    }
    if (filters.to && Time.compareIsoDates(txn.date, filters.to) > 0) {
      return false;
    }
    if (filters.onOrBefore && Time.compareIsoDates(txn.date, filters.onOrBefore) > 0) {
      return false;
    }
    if (filters.after && Time.compareIsoDates(txn.date, filters.after) <= 0) {
      return false;
    }
    return true;
  }

  private matchesWord(txn: Transaction, word?: string): boolean {
    if (!word) {
      return true;
    }
    const needle = word.trim().toLowerCase();
    if (needle.length === 0) {
      return true;
    }
    const descTokens = txn.description
      .split(" ")
      .filter((part) => part.length > 0)
      .map((part) => part.toLowerCase());
    const refTokens = (txn.refNo ?? "")
      .split(" ")
      .filter((part) => part.length > 0)
      .map((part) => part.toLowerCase());
    return descTokens.includes(needle) || refTokens.includes(needle);
  }
}
