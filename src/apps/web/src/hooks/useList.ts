import { usePagination } from "@web/hooks/usePagination";
import { errorMessage } from "@web/utils/errors";
import { useCallback, useEffect, useRef, useState } from "react";

type ListFetchParams<F> = {
  limit: number;
  offset: number;
  filters: F;
};

type ListFetchResult<T> = {
  items: T[];
  total: number;
};

type UseListOptions<T, F> = {
  pageSize: number;
  filters: F;
  fetchPage: (params: ListFetchParams<F>, signal: AbortSignal) => Promise<ListFetchResult<T>>;
};

export function useList<T, F>({ pageSize, filters, fetchPage }: UseListOptions<T, F>) {
  const [items, setItems] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const pagination = usePagination({
    pageSize,
    totalCount,
    resetKey: filters,
  });

  const runFetch = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchPageRef.current(
          { limit: pageSize, offset: pagination.offset, filters },
          signal
        );

        if (signal.aborted) {
          return;
        }

        setItems(result.items);
        setTotalCount(result.total);
        setLoading(false);
      } catch (err: unknown) {
        if (signal.aborted) {
          return;
        }
        setError(errorMessage(err, "Failed to load list."));
        setLoading(false);
      }
    },
    [pageSize, pagination.offset, filters]
  );

  useEffect(() => {
    const controller = new AbortController();

    void runFetch(controller.signal);

    return () => {
      controller.abort();
    };
  }, [runFetch]);

  function refresh(): void {
    void runFetch(new AbortController().signal);
  }

  return {
    items,
    totalCount,
    loading,
    error,
    pagination,
    refresh,
  };
}
