import { formatInstrumentAccountPickerLabel } from "@ndb/platform";
import { SecondaryButton } from "@web/components/Button";
import { Controls } from "@web/components/Pagination/Controls";
import { useActivePeriod } from "@web/contexts/ActivePeriod/Context";
import { useCreditCardCatalogTitles } from "@web/hooks/credit-card-titles";
import { useDebounced } from "@web/hooks/debounced";
import { useList } from "@web/hooks/list";
import { BulkBar } from "@web/routes/accounts/details/_parts/ledger/BulkBar";
import { BulkModal } from "@web/routes/accounts/details/_parts/ledger/BulkModal";
import { Filters } from "@web/routes/accounts/details/_parts/ledger/Filters";
import { ledgerDialogInitialValues } from "@web/routes/accounts/details/_parts/ledger/helpers";
import { Modal } from "@web/routes/accounts/details/_parts/ledger/Modal";
import {
  type AmountFilterMode,
  type LedgerFilters,
  ledgerActiveFilterCount,
  ledgerFiltersActive,
  ledgerFiltersToApiQuery,
} from "@web/routes/accounts/details/_parts/ledger/query";
import { Summary } from "@web/routes/accounts/details/_parts/ledger/Summary";
import { Table } from "@web/routes/accounts/details/_parts/ledger/Table";
import { useRowSelection } from "@web/routes/accounts/details/_parts/ledger/use-row-selection";
import { useTransactionSummary } from "@web/routes/accounts/details/_parts/ledger/use-transaction-summary";
import { defaultTransactionDateForPeriod } from "@web/utils/active-period";
import { useAccounts } from "@web/utils/api/routes/accounts";
import type { AccountDetails } from "@web/utils/api/routes/accounts/types";
import { isSystemAccountType } from "@web/utils/api/routes/accounts/types";
import { fetchCategories } from "@web/utils/api/routes/categories";
import type { CategoryApi } from "@web/utils/api/routes/categories/types";
import { fetchTags } from "@web/utils/api/routes/tags";
import type { TagApi } from "@web/utils/api/routes/tags/types";
import { fetchSystemAccounts, fetchTransactions } from "@web/utils/api/routes/transactions";
import type { SystemAccountApi, TransactionApi } from "@web/utils/api/routes/transactions/types";
import { DEFAULT_LIST_PAGE_SIZE } from "@web/utils/constants";
import { useCallback, useEffect, useMemo, useState } from "react";

type TransactionLedgerProps = {
  accountId: string;
  details: AccountDetails;
  onChanged?: () => void;
};

type LedgerDialog = { mode: "add" } | { mode: "edit"; transaction: TransactionApi };

export function Ledger({ accountId, details, onChanged }: TransactionLedgerProps) {
  const { from, to, unbounded } = useActivePeriod();
  const defaultTxnDate = useMemo(
    () => defaultTransactionDateForPeriod(from, to, undefined, unbounded),
    [from, to, unbounded]
  );
  const systemPage = isSystemAccountType(details.account.accountType);
  const { accounts: instruments } = useAccounts({ status: "open" });
  const catalogTitles = useCreditCardCatalogTitles();
  const [systemAccounts, setSystemAccounts] = useState<SystemAccountApi[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryApi[]>([]);
  const [allTags, setAllTags] = useState<TagApi[]>([]);
  const [descriptionInput, setDescriptionInput] = useState("");
  const debouncedDescription = useDebounced(descriptionInput);
  const [filterSourceAccountId, setFilterSourceAccountId] = useState("");
  const [filterDestinationAccountId, setFilterDestinationAccountId] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterTagId, setFilterTagId] = useState("");
  const [amountMode, setAmountMode] = useState<AmountFilterMode>("any");
  const [amountMinInput, setAmountMinInput] = useState("");
  const [amountMaxInput, setAmountMaxInput] = useState("");
  const debouncedAmountMin = useDebounced(amountMinInput);
  const debouncedAmountMax = useDebounced(amountMaxInput);
  const [dialog, setDialog] = useState<LedgerDialog | null>(null);

  const unknownId = systemAccounts.find((item) => item.accountType === "unknown")?.id ?? "";

  useEffect(() => {
    void fetchSystemAccounts().then(setSystemAccounts);
  }, []);

  useEffect(() => {
    void Promise.all([fetchCategories({ limit: 200 }), fetchTags({ limit: 200 })]).then(
      ([categories, tags]) => {
        setAllCategories(categories.items);
        setAllTags(tags.items);
      }
    );
  }, []);

  const pickerOptions = useMemo(() => {
    const instrumentOptions = instruments.map((account) => ({
      id: account.id,
      label: formatInstrumentAccountPickerLabel(account, catalogTitles),
    }));
    const systemOptions = systemAccounts.map((account) => ({
      id: account.id,
      label: account.label,
    }));
    return [...instrumentOptions, ...systemOptions];
  }, [instruments, systemAccounts, catalogTitles]);

  const rootCategories = useMemo(
    () => allCategories.filter((row) => row.parentId === null),
    [allCategories]
  );

  const filters = useMemo<LedgerFilters>(
    () => ({
      from: unbounded ? undefined : from,
      to: unbounded ? undefined : to,
      description: debouncedDescription.trim(),
      sourceAccountId: filterSourceAccountId,
      destinationAccountId: filterDestinationAccountId,
      categoryId: filterCategoryId,
      tagId: filterTagId,
      amountMode,
      amountMinInput: debouncedAmountMin,
      amountMaxInput: debouncedAmountMax,
    }),
    [
      from,
      to,
      unbounded,
      debouncedDescription,
      filterSourceAccountId,
      filterDestinationAccountId,
      filterCategoryId,
      filterTagId,
      amountMode,
      debouncedAmountMin,
      debouncedAmountMax,
    ]
  );

  const filtersActive = useMemo(() => ledgerFiltersActive(filters), [filters]);
  const activeFilterCount = useMemo(() => ledgerActiveFilterCount(filters), [filters]);

  const {
    loading: summaryLoading,
    error: summaryError,
    amountCredit,
    amountDebit,
    txnCount,
  } = useTransactionSummary(accountId, filters);

  function clearLedgerFilters() {
    setDescriptionInput("");
    setFilterSourceAccountId("");
    setFilterDestinationAccountId("");
    setFilterCategoryId("");
    setFilterTagId("");
    setAmountMode("any");
    setAmountMinInput("");
    setAmountMaxInput("");
  }

  const fetchPage = useCallback(
    async (
      {
        limit,
        offset,
        filters: activeFilters,
      }: { limit: number; offset: number; filters: LedgerFilters },
      signal: AbortSignal
    ) => {
      const list = await fetchTransactions(accountId, {
        ...ledgerFiltersToApiQuery(activeFilters),
        limit,
        offset,
      });

      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      return { items: list.items, total: list.total };
    },
    [accountId]
  );

  const {
    items: rows,
    loading,
    error,
    pagination,
    refresh,
  } = useList<TransactionApi, LedgerFilters>({
    pageSize: DEFAULT_LIST_PAGE_SIZE,
    filters,
    fetchPage,
  });

  const selection = useRowSelection(rows, filters, txnCount);

  function subcategoriesFor(categoryId: string): CategoryApi[] {
    return allCategories.filter((row) => row.parentId === categoryId);
  }

  function notifyChanged() {
    onChanged?.();
    refresh();
  }

  const dialogInitialValues = useMemo(
    () => ledgerDialogInitialValues(dialog, accountId, defaultTxnDate, unknownId),
    [accountId, defaultTxnDate, dialog, unknownId]
  );

  return (
    <section className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Transactions</h2>
        <SecondaryButton type="button" onClick={() => setDialog({ mode: "add" })}>
          Add Transaction
        </SecondaryButton>
      </div>

      <Filters
        descriptionInput={descriptionInput}
        onDescriptionInputChange={setDescriptionInput}
        sourceAccountId={filterSourceAccountId}
        onSourceAccountIdChange={setFilterSourceAccountId}
        destinationAccountId={filterDestinationAccountId}
        onDestinationAccountIdChange={setFilterDestinationAccountId}
        categoryId={filterCategoryId}
        onCategoryIdChange={setFilterCategoryId}
        tagId={filterTagId}
        onTagIdChange={setFilterTagId}
        amountMode={amountMode}
        onAmountModeChange={setAmountMode}
        amountMinInput={amountMinInput}
        onAmountMinInputChange={setAmountMinInput}
        amountMaxInput={amountMaxInput}
        onAmountMaxInputChange={setAmountMaxInput}
        partyOptions={pickerOptions}
        rootCategories={rootCategories}
        allTags={allTags}
        filtersActive={filtersActive}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearLedgerFilters}
      />

      <Summary
        loading={summaryLoading}
        listLoading={loading}
        error={summaryError ?? (error ? error : null)}
        amountCredit={amountCredit}
        amountDebit={amountDebit}
        txnCount={txnCount}
        filtersActive={filtersActive}
      />

      <BulkBar
        accountId={accountId}
        filters={filters}
        selectedCount={selection.selectedCount}
        showSelectAllFiltered={selection.showSelectAllFiltered}
        txnCount={txnCount}
        allFiltered={selection.allFiltered}
        onSelectAllFiltered={() => selection.setAllFiltered(true)}
        onBulkEdit={selection.openBulkEdit}
        onClearSelection={selection.clearSelection}
        selectedRows={selection.selectedRows}
        onDeleted={() => {
          selection.clearSelection();
          notifyChanged();
        }}
      />

      <Table
        accountId={accountId}
        systemPage={systemPage}
        rows={rows}
        allFiltered={selection.allFiltered}
        pageFullySelected={selection.pageFullySelected}
        selectedRows={selection.selectedRows}
        headerSelectRef={selection.headerSelectRef}
        onToggleVisiblePage={selection.toggleVisiblePage}
        onToggleRow={selection.toggleRow}
        onEditRow={(row) => setDialog({ mode: "edit", transaction: row })}
        onRowDeleted={notifyChanged}
      />

      <Controls pagination={pagination} />

      <BulkModal
        open={selection.bulkOpen}
        onClose={() => selection.setBulkOpen(false)}
        accountId={accountId}
        selection={selection.bulkSelection}
        partyOptions={pickerOptions}
        rootCategories={rootCategories}
        subcategoriesForCategory={subcategoriesFor}
        allTags={allTags}
        onSaved={() => {
          selection.clearSelection();
          notifyChanged();
        }}
      />

      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        mode={dialog?.mode ?? "add"}
        accountId={accountId}
        transactionId={dialog?.mode === "edit" ? dialog.transaction.id : undefined}
        initialValues={dialogInitialValues}
        rootCategories={rootCategories}
        partyOptions={pickerOptions}
        subcategoriesForCategory={subcategoriesFor}
        allTags={allTags}
        onSaved={notifyChanged}
      />
    </section>
  );
}
