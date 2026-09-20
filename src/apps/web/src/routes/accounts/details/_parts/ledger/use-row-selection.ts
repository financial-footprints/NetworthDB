import type { BulkSelection } from "@web/routes/accounts/details/_parts/ledger/BulkModal";
import {
  type LedgerFilters,
  ledgerFiltersToApiQuery,
} from "@web/routes/accounts/details/_parts/ledger/query";
import type { TransactionApi } from "@web/utils/api/routes/transactions/types";
import { useEffect, useMemo, useRef, useState } from "react";

export function useRowSelection(
  rows: TransactionApi[],
  filters: LedgerFilters,
  txnCount: number | null
) {
  const [selectedRows, setSelectedRows] = useState<Map<string, TransactionApi>>(new Map());
  const [allFiltered, setAllFiltered] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSelection, setBulkSelection] = useState<BulkSelection | null>(null);
  const headerSelectRef = useRef<HTMLInputElement>(null);
  const filterQuery = useMemo(() => ledgerFiltersToApiQuery(filters), [filters]);
  const lastFilterQueryRef = useRef(filterQuery);

  if (lastFilterQueryRef.current !== filterQuery) {
    lastFilterQueryRef.current = filterQuery;
    setAllFiltered(false);
    setSelectedRows(new Map());
    setBulkOpen(false);
    setBulkSelection(null);
  }

  const pageFullySelected = rows.length > 0 && rows.every((row) => selectedRows.has(row.id));
  const pagePartlySelected = rows.some((row) => selectedRows.has(row.id));
  const selectedCount = allFiltered ? (txnCount ?? 0) : selectedRows.size;
  const showSelectAllFiltered =
    !allFiltered && pageFullySelected && txnCount !== null && txnCount > rows.length;

  useEffect(() => {
    if (headerSelectRef.current) {
      headerSelectRef.current.indeterminate =
        !allFiltered && pagePartlySelected && !pageFullySelected;
    }
  }, [allFiltered, pageFullySelected, pagePartlySelected]);

  function toggleVisiblePage() {
    if (allFiltered) {
      setAllFiltered(false);
      setSelectedRows(new Map());
      return;
    }
    setSelectedRows((current) => {
      const next = new Map(current);
      if (pageFullySelected) {
        for (const row of rows) {
          next.delete(row.id);
        }
      } else {
        for (const row of rows) {
          next.set(row.id, row);
        }
      }
      return next;
    });
  }

  function toggleRow(row: TransactionApi) {
    if (allFiltered) {
      setAllFiltered(false);
      setSelectedRows(() => {
        const next = new Map<string, TransactionApi>();
        for (const visible of rows) {
          if (visible.id !== row.id) {
            next.set(visible.id, visible);
          }
        }
        return next;
      });
      return;
    }
    setSelectedRows((current) => {
      const next = new Map(current);
      if (next.has(row.id)) {
        next.delete(row.id);
      } else {
        next.set(row.id, row);
      }
      return next;
    });
  }

  function clearSelection() {
    setAllFiltered(false);
    setSelectedRows(new Map());
  }

  function openBulkEdit() {
    if (allFiltered) {
      setBulkSelection({
        kind: "filtered",
        total: txnCount ?? 0,
        query: ledgerFiltersToApiQuery(filters),
      });
    } else {
      setBulkSelection({ kind: "rows", rows: [...selectedRows.values()] });
    }
    setBulkOpen(true);
  }

  return {
    selectedRows,
    allFiltered,
    setAllFiltered,
    bulkOpen,
    setBulkOpen,
    bulkSelection,
    headerSelectRef,
    pageFullySelected,
    selectedCount,
    showSelectAllFiltered,
    toggleVisiblePage,
    toggleRow,
    clearSelection,
    openBulkEdit,
  };
}
