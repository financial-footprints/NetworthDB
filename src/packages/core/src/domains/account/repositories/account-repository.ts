import type { AccountType } from "@core/domains/account/constants";
import type { Account } from "@core/domains/account/entities/account";
import type { Pagination, Sort } from "@core/shared/query";

export type AccountFilters = {
  id?: string;
  userId?: string;
  accountType?: AccountType;
};

export type AccountSortColumn = "createdAt" | "label";

export interface AccountRepository {
  create(account: Account): Promise<Account>;
  findById(userId: string, accountId: string): Promise<Account | null>;
  findByFilters(
    filters: AccountFilters,
    sort?: Sort<AccountSortColumn>,
    pagination?: Pagination
  ): Promise<Account[]>;
  save(account: Account): Promise<Account>;
  aggregate(filters: AccountFilters): Promise<number>;
  delete(filters: AccountFilters): Promise<void>;
}
