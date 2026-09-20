import { PageBoundary } from "@web/components/Layout/PageBoundary";
import { PageTitle } from "@web/components/Layout/PageTitle";
import { Search } from "@web/components/List/Search";
import { Sort } from "@web/components/List/Sort";
import { Toolbar } from "@web/components/List/Toolbar";
import { useListQuery } from "@web/hooks/query";
import { SyncButton } from "@web/routes/accounts/_parts/SyncButton";
import { Bank } from "@web/routes/accounts/_parts/tiles/Bank";
import { Card } from "@web/routes/accounts/_parts/tiles/Card";
import { Content } from "@web/routes/accounts/list/_parts/Content";
import {
  accountsListConfig,
  accountsListDefaultSort,
  filterAccountsByClientSearch,
  toAccountListQuery,
} from "@web/routes/accounts/list/query";
import Loading from "@web/routes/accounts/list/suspense";
import { accountDateToIso } from "@web/utils/active-period";
import { invalidateAllAccountCaches, useAccounts } from "@web/utils/api/routes/accounts";
import type { Account } from "@web/utils/api/routes/accounts/types";
import {
  ACCOUNT_TYPE_LABELS,
  INSTRUMENT_ACCOUNT_TYPE_OPTIONS,
} from "@web/utils/api/routes/accounts/types";
import { readDEK } from "@web/utils/crypto/session";
import { todayAccountDate } from "@web/utils/time";
import { useEffect, useMemo, useState } from "react";

const SORT_OPTIONS = [
  { field: "label" as const, label: "Name" },
  { field: "accountType" as const, label: "Type" },
  { field: "currentBalance" as const, label: "Balance" },
];

type AccountListTileProps = {
  account: Account;
  showClosedBadge: boolean;
  asOf: string;
};

function AccountListTile({ account, showClosedBadge, asOf }: AccountListTileProps) {
  const closed =
    showClosedBadge &&
    account.closingDate !== null &&
    accountDateToIso(account.closingDate) < accountDateToIso(asOf);
  const tile =
    account.accountType === "credit_card" ? (
      <Card account={account} linkToDetail />
    ) : (
      <Bank account={account} linkToDetail />
    );
  return (
    <div className="relative">
      {closed ? (
        <span className="absolute right-2 top-2 z-10 rounded bg-slate-800/80 px-2 py-0.5 text-xs font-medium text-white">
          Closed
        </span>
      ) : null}
      {tile}
    </div>
  );
}

export default function AccountsListPage() {
  const listQuery = useListQuery(accountsListConfig);
  const [dek, setDek] = useState<CryptoKey | null>(null);

  useEffect(() => {
    void readDEK().then(setDek);
  }, []);

  const omitServerSearch = Boolean(dek && listQuery.search.trim());
  const sort = listQuery.sort ?? accountsListDefaultSort;

  const apiQuery = useMemo(
    () =>
      toAccountListQuery(listQuery.search, listQuery.filters, sort, {
        omitServerSearch,
      }),
    [listQuery.search, listQuery.filters, sort, omitServerSearch]
  );

  const { accounts: fetchedAccounts } = useAccounts(apiQuery);

  const accounts = useMemo(() => {
    if (!omitServerSearch) {
      return fetchedAccounts;
    }
    return filterAccountsByClientSearch(fetchedAccounts, listQuery.search);
  }, [fetchedAccounts, listQuery.search, omitServerSearch]);

  const status = listQuery.filters.status || "open";
  const filtersActive = listQuery.hasActiveFilters;
  const emptyTitle = filtersActive ? "No accounts match" : "No accounts configured";
  const emptyMessage =
    status === "closed"
      ? "No closed accounts."
      : filtersActive
        ? "Try a different search or filter."
        : "Add a bank, card, or other account to get started.";

  const asOf = todayAccountDate();
  const showClosedBadge = status === "all" || status === "closed";

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageTitle page="Accounts" />

      <PageBoundary
        errorTitle="Could not load accounts"
        onRetry={() => invalidateAllAccountCaches()}
        loadingFallback={<Loading />}
      >
        <Toolbar
          search={
            <Search
              value={listQuery.searchInput}
              placeholder="Search Accounts"
              onChange={listQuery.setSearchInput}
            />
          }
          filters={
            <>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span className="sr-only">Account Type</span>
                <select
                  className="form-input w-auto min-w-[9rem]"
                  value={listQuery.filters.account_type}
                  onChange={(event) => listQuery.setFilter("account_type", event.target.value)}
                >
                  <option value="">All Types</option>
                  {INSTRUMENT_ACCOUNT_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {ACCOUNT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span className="sr-only">Open or Closed</span>
                <select
                  className="form-input w-auto min-w-[9rem]"
                  value={status}
                  onChange={(event) => listQuery.setFilter("status", event.target.value)}
                >
                  <option value="open">Open Accounts</option>
                  <option value="closed">Closed Accounts</option>
                  <option value="all">All Accounts</option>
                </select>
              </label>
            </>
          }
          sort={
            <Sort
              options={SORT_OPTIONS}
              sort={sort}
              onSortFieldChange={listQuery.setSortField}
              onSortDirectionChange={listQuery.setSortDirection}
            />
          }
        />

        <Content
          accounts={accounts}
          headingTitle="Accounts"
          emptyTitle={emptyTitle}
          emptyMessage={emptyMessage}
          gridClassName="account-tile-grid sm:grid-cols-2 lg:grid-cols-3"
          listWrapperClassName="w-full"
          toolbar={<SyncButton scope="all_accounts" />}
          Tile={({ account }) => (
            <AccountListTile account={account} showClosedBadge={showClosedBadge} asOf={asOf} />
          )}
        />
      </PageBoundary>
    </div>
  );
}
