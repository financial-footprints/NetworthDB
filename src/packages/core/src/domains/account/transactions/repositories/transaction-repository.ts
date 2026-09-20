import type { MonthlySummary } from "@core/domains/account/transactions/entities/monthly-summary";
import type { Transaction } from "@core/domains/account/transactions/entities/transaction";
import type { TransactionImport } from "@core/domains/account/transactions/entities/transaction-import";
import type { Pagination, Sort } from "@core/shared/query";

export type TransactionFilters = {
  id?: string;
  userId?: string;
  accountId?: string;
  importId?: string;
  from?: string;
  to?: string;
  onOrBefore?: string;
  after?: string;
  word?: string;
  categoryId?: string;
  subcategoryId?: string;
  tagId?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  amountMin?: number;
  amountMax?: number;
};

export type TransactionSortColumn = "date";

export type TransactionCursor = { date: string; createdAt: string; id: string };

export type OwnedId = { id: string; userId: string };

export type AmountAggregate = {
  amountCredit: number;
  amountDebit: number;
  txnCount: number;
};

export type TransactionDateExtent = {
  min: string | null;
  max: string | null;
};

export interface TransactionRepository {
  createImport(importRow: TransactionImport): Promise<TransactionImport>;
  deleteImport(userId: string, accountId: string, importId: string): Promise<boolean>;

  create(transaction: Transaction): Promise<Transaction>;
  createMany(transactions: Transaction[]): Promise<Transaction[]>;
  save(transaction: Transaction): Promise<Transaction>;
  saveMany(transactions: Transaction[]): Promise<Transaction[]>;
  delete(userId: string, transactionId: string): Promise<boolean>;
  deleteMany(userId: string, ids: string[]): Promise<number>;

  findById(userId: string, transactionId: string): Promise<Transaction | null>;
  findByIds(userId: string, ids: string[]): Promise<Transaction[]>;
  findByFilters(
    filters: TransactionFilters,
    sort?: Sort<TransactionSortColumn>,
    pagination?: Pagination
  ): Promise<Transaction[]>;
  aggregate(filters: TransactionFilters): Promise<number>;
  sumAmounts(filters: TransactionFilters): Promise<AmountAggregate>;
  getDateExtent(
    filters: Pick<TransactionFilters, "userId" | "accountId">
  ): Promise<TransactionDateExtent>;

  listMonthlySummaries(
    userId: string,
    accountId: string,
    onOrBeforePeriodEnd?: string
  ): Promise<MonthlySummary[]>;
  latestMonthlySummaryBefore(
    userId: string,
    accountId: string,
    onOrBefore: string
  ): Promise<MonthlySummary | null>;
  deleteMonthlySummariesFrom(
    userId: string,
    accountId: string,
    year: number,
    month: number
  ): Promise<void>;
  replaceMonthlySummaries(userId: string, accountId: string, rows: MonthlySummary[]): Promise<void>;

  listImports(userId: string): Promise<TransactionImport[]>;
  listByUserCursor(
    userId: string,
    after: TransactionCursor | null,
    limit: number
  ): Promise<Transaction[]>;
  listByFiltersCursor(
    filters: TransactionFilters,
    after: TransactionCursor | null,
    limit: number
  ): Promise<Transaction[]>;
  findImportIds(ids: string[]): Promise<OwnedId[]>;
  findTransactionIds(ids: string[]): Promise<OwnedId[]>;
}
