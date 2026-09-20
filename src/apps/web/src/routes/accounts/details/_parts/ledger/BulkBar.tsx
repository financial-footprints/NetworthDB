import { ConfirmDeleteButton, IconActionButton } from "@web/components/Button";
import {
  BULK_TRANSACTION_LIMIT,
  loadMatchingTransactions,
} from "@web/routes/accounts/details/_parts/ledger/helpers";
import {
  type LedgerFilters,
  ledgerFiltersToApiQuery,
} from "@web/routes/accounts/details/_parts/ledger/query";
import { bulkDeleteTransactions } from "@web/utils/api/routes/transactions";
import type { TransactionApi } from "@web/utils/api/routes/transactions/types";
import { LuPencil, LuX } from "react-icons/lu";

type LedgerBulkBarProps = {
  accountId: string;
  filters: LedgerFilters;
  selectedCount: number;
  showSelectAllFiltered: boolean;
  txnCount: number | null;
  allFiltered: boolean;
  onSelectAllFiltered: () => void;
  onBulkEdit: () => void;
  onClearSelection: () => void;
  selectedRows: Map<string, TransactionApi>;
  onDeleted: () => void;
};

export function BulkBar({
  accountId,
  filters,
  selectedCount,
  showSelectAllFiltered,
  txnCount,
  allFiltered,
  onSelectAllFiltered,
  onBulkEdit,
  onClearSelection,
  selectedRows,
  onDeleted,
}: LedgerBulkBarProps) {
  if (selectedCount <= 0) {
    return null;
  }

  return (
    <div className="ledger-bulk-bar" role="status" aria-live="polite">
      <div className="ledger-bulk-bar-primary">
        <span className="ledger-bulk-bar-count">{selectedCount.toLocaleString()} selected</span>
        {showSelectAllFiltered ? (
          <button type="button" className="ledger-bulk-bar-link" onClick={onSelectAllFiltered}>
            Select all {txnCount?.toLocaleString()} matching filters
          </button>
        ) : null}
        {allFiltered ? (
          <span className="text-sm text-slate-600">All matching transactions</span>
        ) : null}
      </div>
      <div className="ledger-bulk-bar-actions">
        <IconActionButton title="Edit selected" tone="edit" onClick={onBulkEdit}>
          <LuPencil className="size-4" strokeWidth={2} aria-hidden />
        </IconActionButton>
        {selectedCount <= BULK_TRANSACTION_LIMIT ? (
          <ConfirmDeleteButton
            variant="icon"
            title="Delete selected"
            confirmMessage={`Delete ${selectedCount} transactions? This cannot be undone.`}
            errorMessage="Could not delete transactions"
            onDelete={async () => {
              const ids = allFiltered
                ? (await loadMatchingTransactions(accountId, ledgerFiltersToApiQuery(filters))).map(
                    (row) => row.id
                  )
                : [...selectedRows.keys()];
              if (ids.length > BULK_TRANSACTION_LIMIT) {
                throw new Error(
                  "Delete supports up to " +
                    `${BULK_TRANSACTION_LIMIT.toLocaleString()} transactions. Narrow the filters.`
                );
              }
              if (ids.length === 0) {
                return;
              }
              await bulkDeleteTransactions(accountId, ids);
              onDeleted();
            }}
          />
        ) : null}
        <IconActionButton title="Clear selection" onClick={onClearSelection}>
          <LuX className="size-4" strokeWidth={2} aria-hidden />
        </IconActionButton>
      </div>
      {selectedCount > BULK_TRANSACTION_LIMIT ? (
        <p className="ledger-bulk-bar-warning">
          Delete supports up to {BULK_TRANSACTION_LIMIT.toLocaleString()} transactions. Narrow the
          filters.
        </p>
      ) : null}
    </div>
  );
}
