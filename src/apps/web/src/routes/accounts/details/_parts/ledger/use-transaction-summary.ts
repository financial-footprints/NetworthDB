import {
  type LedgerFilters,
  ledgerFiltersToApiQuery,
} from "@web/routes/accounts/details/_parts/ledger/query";
import { fetchTransactionSummary } from "@web/utils/api/routes/transactions";
import { errorMessage } from "@web/utils/errors";
import { useEffect, useState } from "react";

export function useTransactionSummary(accountId: string, filters: LedgerFilters) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountCredit, setAmountCredit] = useState<number | null>(null);
  const [amountDebit, setAmountDebit] = useState<number | null>(null);
  const [txnCount, setTxnCount] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void fetchTransactionSummary(accountId, ledgerFiltersToApiQuery(filters))
      .then((summary) => {
        if (controller.signal.aborted) {
          return;
        }
        setAmountCredit(summary.amountCredit);
        setAmountDebit(summary.amountDebit);
        setTxnCount(summary.txnCount);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(err, "Failed to load range summary"));
          setAmountCredit(null);
          setAmountDebit(null);
          setTxnCount(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [accountId, filters]);

  return { loading, error, amountCredit, amountDebit, txnCount };
}
