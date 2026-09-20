import { ConfirmDeleteButton, IconActionButton } from "@web/components/Button";
import { path } from "@web/router/routes";
import {
  ledgerAmountDisplay,
  ledgerCategoryCellLabel,
} from "@web/routes/accounts/details/_parts/ledger/helpers";
import { deleteTransaction } from "@web/utils/api/routes/transactions";
import type { TransactionApi, TransactionPartyApi } from "@web/utils/api/routes/transactions/types";
import { formatDisplayDateCompact } from "@web/utils/time";
import type { RefObject } from "react";
import { LuPencil } from "react-icons/lu";
import { Link } from "react-router-dom";

type TransactionTagApi = TransactionApi["tags"][number];

type LedgerTableProps = {
  accountId: string;
  systemPage: boolean;
  rows: TransactionApi[];
  allFiltered: boolean;
  pageFullySelected: boolean;
  selectedRows: Map<string, TransactionApi>;
  headerSelectRef: RefObject<HTMLInputElement | null>;
  onToggleVisiblePage: () => void;
  onToggleRow: (row: TransactionApi) => void;
  onEditRow: (row: TransactionApi) => void;
  onRowDeleted: () => void;
};

function PartyLink({ party }: { party: TransactionPartyApi }) {
  return (
    <Link
      to={path.accounts.details(party.id)}
      className="text-sky-700 underline underline-offset-2 hover:text-sky-900"
      title={`Open ${party.label}`}
    >
      {party.label}
    </Link>
  );
}

export function Table({
  accountId,
  systemPage,
  rows,
  allFiltered,
  pageFullySelected,
  selectedRows,
  headerSelectRef,
  onToggleVisiblePage,
  onToggleRow,
  onEditRow,
  onRowDeleted,
}: LedgerTableProps) {
  return (
    <div className="ledger-table-scroll">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b text-slate-500">
            <th className="py-2 pr-3">
              <input
                ref={headerSelectRef}
                type="checkbox"
                aria-label="Select visible transactions"
                checked={allFiltered || pageFullySelected}
                onChange={onToggleVisiblePage}
                disabled={rows.length === 0}
              />
            </th>
            <th className="py-2 pr-4">Date</th>
            <th className="py-2 pr-4">Description</th>
            <th className="py-2 pr-4">From</th>
            <th className="py-2 pr-4">To</th>
            <th className="py-2 pr-4">Amount</th>
            <th className="py-2 pr-4">Category</th>
            <th className="py-2 pr-4">Tags</th>
            <th className="py-2"> </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="py-2 pr-3">
                <input
                  type="checkbox"
                  aria-label={`Select ${row.description}`}
                  checked={allFiltered || selectedRows.has(row.id)}
                  onChange={() => onToggleRow(row)}
                />
              </td>
              <td className="py-2 pr-4 whitespace-nowrap">{formatDisplayDateCompact(row.date)}</td>
              <td className="py-2 pr-4">{row.description}</td>
              <td className="py-2 pr-4">
                <PartyLink party={row.source} />
              </td>
              <td className="py-2 pr-4">
                <PartyLink party={row.destination} />
              </td>
              <td className="py-2 pr-4 tabular-nums">
                {ledgerAmountDisplay(row, accountId, systemPage)}
              </td>
              <td className="py-2 pr-4">{ledgerCategoryCellLabel(row)}</td>
              <td className="py-2 pr-4">
                {row.tags.length > 0
                  ? row.tags.map((tag: TransactionTagApi) => tag.name).join(", ")
                  : "—"}
              </td>
              <td className="py-2 align-middle leading-none">
                <div className="inline-flex items-center gap-0.5">
                  <IconActionButton title="Edit" tone="edit" onClick={() => onEditRow(row)}>
                    <LuPencil className="size-4" strokeWidth={1.75} aria-hidden />
                  </IconActionButton>
                  <ConfirmDeleteButton
                    variant="icon"
                    title="Delete"
                    confirmMessage="Delete this transaction? This cannot be undone."
                    errorMessage="Could not delete transaction"
                    onDelete={async () => {
                      await deleteTransaction(accountId, row.id);
                      onRowDeleted();
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
