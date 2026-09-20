import { formatIntegerAsRupee } from "@web/utils/money";

type TransactionLedgerSummaryBarProps = {
  loading: boolean;
  listLoading: boolean;
  error: string | null;
  amountCredit: number | null;
  amountDebit: number | null;
  txnCount: number | null;
  filtersActive: boolean;
};

export function Summary({
  loading,
  listLoading,
  error,
  amountCredit,
  amountDebit,
  txnCount,
  filtersActive,
}: TransactionLedgerSummaryBarProps) {
  if (error) {
    return (
      <p className="ledger-summary-bar mb-4 text-sm text-red-600" role="alert">
        {error}
      </p>
    );
  }

  if (loading) {
    return <p className="ledger-summary-bar mb-4 text-sm text-slate-600">Loading summary…</p>;
  }

  const credit = amountCredit ?? 0;
  const debit = amountDebit ?? 0;
  const count = txnCount ?? 0;

  return (
    <div className="ledger-summary-bar mb-4">
      <div className="ledger-stat-grid">
        <div className="ledger-stat-cell">
          <span className="ledger-stat-label">In</span>
          <span className="ledger-stat-value tabular-nums">₹{formatIntegerAsRupee(credit)}</span>
        </div>
        <div className="ledger-stat-cell">
          <span className="ledger-stat-label">Out</span>
          <span className="ledger-stat-value tabular-nums">₹{formatIntegerAsRupee(debit)}</span>
        </div>
        <div className="ledger-stat-cell">
          <span className="ledger-stat-label">Transactions</span>
          <span className="ledger-stat-value tabular-nums">{count}</span>
        </div>
      </div>
      {listLoading ? <p className="mt-2 text-sm text-slate-500">Loading transactions…</p> : null}
      {filtersActive ? (
        <p className="mt-2 text-xs text-slate-500">
          In, out, and transaction count reflect your filters.
        </p>
      ) : null}
    </div>
  );
}
