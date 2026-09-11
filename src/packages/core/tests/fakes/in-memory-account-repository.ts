import type { Account } from "@core/domains/account/entities/account";
import type {
  AccountFilters,
  AccountRepository,
  AccountSortColumn,
} from "@core/domains/account/repositories/account-repository";
import { ConflictError } from "@core/shared/errors/domain-error";
import type { Pagination, Sort } from "@core/shared/query";
import { paginate, sortByColumn } from "@tests/core/fakes/repository-helpers";

export class InMemoryAccountRepository implements AccountRepository {
  private readonly byId = new Map<string, Account>();

  async create(account: Account): Promise<Account> {
    if (this.byId.has(account.id)) {
      throw new ConflictError("core.account.create.conflict.id-taken", { id: account.id });
    }

    this.byId.set(account.id, account);
    return account;
  }

  async findById(userId: string, accountId: string): Promise<Account | null> {
    const account = this.byId.get(accountId);
    if (!account || account.userId !== userId) {
      return null;
    }

    return account;
  }

  async findByFilters(
    filters: AccountFilters,
    sort?: Sort<AccountSortColumn>,
    pagination?: Pagination
  ): Promise<Account[]> {
    let items = [...this.byId.values()].filter((account) => this.matches(account, filters));
    items = sortByColumn(
      items,
      {
        label: (account) => account.label,
        createdAt: (account) => account.createdAt,
      },
      sort
    );
    return paginate(items, pagination);
  }

  async save(account: Account): Promise<Account> {
    this.byId.set(account.id, account);
    return account;
  }

  async aggregate(filters: AccountFilters): Promise<number> {
    return [...this.byId.values()].filter((account) => this.matches(account, filters)).length;
  }

  async delete(filters: AccountFilters): Promise<void> {
    if (!filters.id) {
      throw new Error("core.account.delete.invalid.missing-id-filter");
    }

    const account = this.byId.get(filters.id);
    if (!account) {
      return;
    }

    if (filters.userId !== undefined && account.userId !== filters.userId) {
      return;
    }

    this.byId.delete(filters.id);
  }

  private matches(account: Account, filters: AccountFilters): boolean {
    if (filters.id !== undefined && account.id !== filters.id) {
      return false;
    }
    if (filters.userId !== undefined && account.userId !== filters.userId) {
      return false;
    }
    if (filters.accountType !== undefined && account.accountType !== filters.accountType) {
      return false;
    }

    return true;
  }
}
