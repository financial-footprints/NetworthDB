import type { Account } from "@core/domains/account/entities/account";
import { isAccountClosedForList } from "@core/domains/account/helpers";
import type {
  AccountFilters,
  AccountListItem,
  AccountRepository,
  AccountSortColumn,
} from "@core/domains/account/repositories/account-repository";
import { computeBalanceAsOf } from "@core/domains/account/transactions/helpers";
import { ConflictError } from "@core/shared/errors/domain-error";
import type { Pagination, Sort } from "@core/shared/query";
import { Time } from "@core/shared/time";
import { InMemoryTransactionRepository } from "@core/tests/fakes/in-memory-transaction-repository";
import { paginate, sortByColumn } from "@core/tests/fakes/repository-helpers";

export class InMemoryAccountRepository implements AccountRepository {
  readonly transactions = new InMemoryTransactionRepository();

  private readonly byId = new Map<string, Account>();
  private readonly currentBalanceByAccountId = new Map<string, number>();

  setCurrentBalanceForTest(accountId: string, balance: number): void {
    this.currentBalanceByAccountId.set(accountId, balance);
  }

  async create(account: Account): Promise<Account> {
    if (this.byId.has(account.id)) {
      throw new ConflictError("Account id is already taken.", { id: account.id });
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
        accountType: (account) => account.accountType,
        currentBalance: () => 0,
      },
      sort
    );
    return paginate(items, pagination);
  }

  private async resolveCurrentBalance(account: Account, asOf: string): Promise<number> {
    if (this.currentBalanceByAccountId.has(account.id)) {
      return this.currentBalanceByAccountId.get(account.id) ?? 0;
    }
    return computeBalanceAsOf(this.transactions, account.userId, account.id, asOf);
  }

  async listWithBalances(
    filters: AccountFilters,
    sort?: Sort<AccountSortColumn>
  ): Promise<AccountListItem[]> {
    const asOf = filters.asOfIsoDate ?? Time.utcTodayIsoDate();
    const matched = [...this.byId.values()].filter((account) => this.matches(account, filters));
    let items = await Promise.all(
      matched.map(async (account) => ({
        account,
        currentBalance: await this.resolveCurrentBalance(account, asOf),
      }))
    );

    items = sortByColumn(
      items,
      {
        label: (item) => item.account.label,
        createdAt: (item) => item.account.createdAt,
        accountType: (item) => item.account.accountType,
        currentBalance: (item) => item.currentBalance,
      },
      sort
    );

    return items;
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
    if (filters.accountTypes !== undefined && !filters.accountTypes.includes(account.accountType)) {
      return false;
    }
    if (!this.matchesListStatus(account, filters)) {
      return false;
    }
    if (!this.matchesSearchQuery(account, filters.q)) {
      return false;
    }
    return true;
  }

  private matchesListStatus(account: Account, filters: AccountFilters): boolean {
    if (filters.listStatus !== "open" && filters.listStatus !== "closed") {
      return true;
    }
    const asOf = filters.asOfIsoDate ?? "";
    const closed = isAccountClosedForList(account.closingDate, asOf);
    if (filters.listStatus === "open" && closed) {
      return false;
    }
    if (filters.listStatus === "closed" && !closed) {
      return false;
    }
    return true;
  }

  private matchesSearchQuery(account: Account, query?: string): boolean {
    if (query === undefined || query.trim() === "") {
      return true;
    }
    const needle = query.trim().toLowerCase();
    return (
      account.label.toLowerCase().includes(needle) || account.bank.toLowerCase().includes(needle)
    );
  }
}
