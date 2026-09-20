import type {
  Account,
  AccountListQuery,
  AccountListSort,
} from "@web/utils/api/routes/accounts/types";
import type { ListQueryConfig, SortState } from "@web/utils/list";

export type AccountListFilterId = "account_type" | "status";

export const accountsListDefaultSort: SortState<AccountListSort> = {
  field: "label",
  direction: "asc",
};

export const accountsListConfig: ListQueryConfig<AccountListSort, AccountListFilterId> = {
  search: { urlKey: "q" },
  sort: {
    urlKeys: { field: "sort", order: "direction" },
    fieldToUrl: {
      label: "label",
      accountType: "accountType",
      currentBalance: "currentBalance",
    },
    defaultSort: accountsListDefaultSort,
  },
  filters: [
    { id: "account_type", urlKey: "account_type", default: "" },
    { id: "status", urlKey: "status", default: "open" },
  ],
};

export function toAccountListQuery(
  search: string,
  filters: Record<AccountListFilterId, string>,
  sort: SortState<AccountListSort>,
  options?: { omitServerSearch?: boolean }
): AccountListQuery {
  const query: AccountListQuery = {
    sort: sort.field,
    direction: sort.direction,
    status: (filters.status || "open") as AccountListQuery["status"],
  };

  const trimmedSearch = search.trim();
  if (trimmedSearch && !options?.omitServerSearch) {
    query.q = trimmedSearch;
  }

  if (filters.account_type) {
    query.account_type = filters.account_type as AccountListQuery["account_type"];
  }

  return query;
}

export function filterAccountsByClientSearch(accounts: Account[], search: string): Account[] {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return accounts;
  }

  return accounts.filter(
    (account) =>
      account.label.toLowerCase().includes(needle) ||
      account.bank.toLowerCase().includes(needle) ||
      account.accountNumber.toLowerCase().includes(needle)
  );
}
