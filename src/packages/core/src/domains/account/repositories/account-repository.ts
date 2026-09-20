import type { AccountType } from "@core/domains/account/constants";
import type { Account } from "@core/domains/account/entities/account";
import type { AccountListStatus } from "@core/domains/account/helpers";
import type { TransactionRepository } from "@core/domains/account/transactions/repositories/transaction-repository";
import type { Pagination, Sort } from "@core/shared/query";

export type AccountFilters = {
  id?: string;
  userId?: string;
  accountType?: AccountType;
  accountTypes?: readonly AccountType[];
  listStatus?: AccountListStatus;
  asOfIsoDate?: string;
  q?: string;
};

export type AccountSortColumn = "createdAt" | "label" | "accountType" | "currentBalance";

export type AccountListItem = {
  account: Account;
  currentBalance: number;
};

export interface AccountRepository {
  readonly transactions: TransactionRepository;
  create(account: Account): Promise<Account>;
  findById(userId: string, accountId: string): Promise<Account | null>;
  findByFilters(
    filters: AccountFilters,
    sort?: Sort<AccountSortColumn>,
    pagination?: Pagination
  ): Promise<Account[]>;
  listWithBalances(
    filters: AccountFilters,
    sort?: Sort<AccountSortColumn>
  ): Promise<AccountListItem[]>;
  save(account: Account): Promise<Account>;
  aggregate(filters: AccountFilters): Promise<number>;
  delete(filters: AccountFilters): Promise<void>;
}
