import { useDebounced } from "@web/hooks/debounced";
import type { ListQueryConfig } from "@web/utils/list";
import {
  encodeSortParamUpdates,
  parseSortParam,
  patchUrlParams,
  readStringParam,
  type SortState,
} from "@web/utils/list";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

const DEFAULT_SEARCH_KEY = "q";
const DEFAULT_PAGE_KEY = "page";
const DEFAULT_PAGE_SIZE_KEY = "pageSize";

type ListFiltersState<TFilterId extends string> = Record<TFilterId, string>;

function emptyFilters<TFilterId extends string>(
  filters: readonly { id: TFilterId; default?: string }[] | undefined
): ListFiltersState<TFilterId> {
  const result = {} as ListFiltersState<TFilterId>;
  for (const filter of filters ?? []) {
    result[filter.id] = filter.default ?? "";
  }
  return result;
}

function parseFilters<TFilterId extends string>(
  params: URLSearchParams,
  filters: readonly { id: TFilterId; urlKey: string; default?: string }[] | undefined
): ListFiltersState<TFilterId> {
  const result = emptyFilters(filters);
  for (const filter of filters ?? []) {
    const fallback = filter.default ?? "";
    result[filter.id] = readStringParam(params, filter.urlKey, fallback);
  }
  return result;
}

function encodeFiltersUpdates<TFilterId extends string>(
  filters: ListFiltersState<TFilterId>,
  defs: readonly { id: TFilterId; urlKey: string; default?: string }[] | undefined
): Record<string, string | null> {
  const updates: Record<string, string | null> = {};
  for (const def of defs ?? []) {
    const value = filters[def.id];
    const fallback = def.default ?? "";
    updates[def.urlKey] = value === fallback ? null : value || null;
  }
  return updates;
}

function withPageReset(
  updates: Record<string, string | null>,
  pagination: ListQueryConfig<string, string>["pagination"],
  pageKey: string
): Record<string, string | null> {
  if (!pagination) {
    return updates;
  }

  return {
    ...updates,
    [pageKey]: null,
  };
}

export function useListQuery<TSortField extends string, TFilterId extends string>(
  config: ListQueryConfig<TSortField, TFilterId>
) {
  const [params, setSearchParams] = useSearchParams();

  const patch = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams((current) => patchUrlParams(current, updates), { replace: true });
    },
    [setSearchParams]
  );

  const searchKey = config.search?.urlKey ?? DEFAULT_SEARCH_KEY;
  const pageKey = config.pagination?.pageKey ?? DEFAULT_PAGE_KEY;
  const pageSizeKey = config.pagination?.pageSizeKey ?? DEFAULT_PAGE_SIZE_KEY;
  const defaultPage = config.pagination?.defaultPage ?? 1;
  const defaultPageSize = config.pagination?.defaultPageSize ?? 25;

  const urlSearch = readStringParam(params, searchKey);
  const [searchInput, setSearchInput] = useState(urlSearch);
  const debouncedSearch = useDebounced(searchInput);

  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    if (debouncedSearch === urlSearch) {
      return;
    }
    patch(withPageReset({ [searchKey]: debouncedSearch || null }, config.pagination, pageKey));
  }, [debouncedSearch, urlSearch, patch, searchKey, config.pagination, pageKey]);

  const filters = useMemo(() => parseFilters(params, config.filters), [params, config.filters]);

  const urlSort = useMemo((): SortState<TSortField> | null => {
    if (!config.sort) {
      return null;
    }
    return parseSortParam(params, config.sort.fieldToUrl, config.sort.urlKeys);
  }, [params, config.sort]);

  const sort = useMemo((): SortState<TSortField> | null => {
    if (urlSort) {
      return urlSort;
    }
    if (config.sort) {
      return config.sort.defaultSort;
    }
    return null;
  }, [urlSort, config.sort]);

  const page = useMemo(() => {
    if (!config.pagination) {
      return defaultPage;
    }
    const raw = params.get(pageKey);
    const parsed = raw ? Number.parseInt(raw, 10) : defaultPage;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultPage;
  }, [params, config.pagination, pageKey, defaultPage]);

  const pageSize = useMemo(() => {
    if (!config.pagination) {
      return defaultPageSize;
    }
    const raw = params.get(pageSizeKey);
    const parsed = raw ? Number.parseInt(raw, 10) : defaultPageSize;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultPageSize;
  }, [params, config.pagination, pageSizeKey, defaultPageSize]);

  const setFilters = useCallback(
    (next: ListFiltersState<TFilterId>) => {
      patch(withPageReset(encodeFiltersUpdates(next, config.filters), config.pagination, pageKey));
    },
    [config.filters, config.pagination, patch, pageKey]
  );

  const setFilter = useCallback(
    (id: TFilterId, value: string) => {
      setFilters({ ...filters, [id]: value });
    },
    [filters, setFilters]
  );

  const clearFilters = useCallback(() => {
    setSearchInput("");
    const cleared = emptyFilters(config.filters);
    patch(
      withPageReset(
        {
          [searchKey]: null,
          ...encodeFiltersUpdates(cleared, config.filters),
        },
        config.pagination,
        pageKey
      )
    );
  }, [config.filters, config.pagination, patch, searchKey, pageKey]);

  const setSortField = useCallback(
    (field: TSortField) => {
      if (!config.sort) {
        return;
      }
      if (!sort) {
        return;
      }
      const next: SortState<TSortField> = { field, direction: sort.direction };
      patch(
        withPageReset(
          encodeSortParamUpdates(next, config.sort.fieldToUrl, config.sort.urlKeys),
          config.pagination,
          pageKey
        )
      );
    },
    [config.sort, config.pagination, sort, patch, pageKey]
  );

  const setSortDirection = useCallback(
    (direction: "asc" | "desc") => {
      if (!config.sort) {
        return;
      }
      if (!sort) {
        return;
      }
      const next: SortState<TSortField> = { field: sort.field, direction };
      patch(
        withPageReset(
          encodeSortParamUpdates(next, config.sort.fieldToUrl, config.sort.urlKeys),
          config.pagination,
          pageKey
        )
      );
    },
    [config.sort, config.pagination, sort, patch, pageKey]
  );

  const clearSort = useCallback(() => {
    if (!config.sort) {
      return;
    }
    patch(
      withPageReset(
        encodeSortParamUpdates(null, config.sort.fieldToUrl, config.sort.urlKeys),
        config.pagination,
        pageKey
      )
    );
  }, [config.sort, config.pagination, patch, pageKey]);

  const setPage = useCallback(
    (nextPage: number) => {
      if (!config.pagination) {
        return;
      }
      patch({
        [pageKey]: nextPage === defaultPage ? null : String(nextPage),
      });
    },
    [config.pagination, pageKey, defaultPage, patch]
  );

  const setPageSize = useCallback(
    (nextPageSize: number) => {
      if (!config.pagination) {
        return;
      }
      patch({
        [pageSizeKey]: nextPageSize === defaultPageSize ? null : String(nextPageSize),
        [pageKey]: null,
      });
    },
    [config.pagination, pageSizeKey, defaultPageSize, pageKey, patch]
  );

  const hasActiveFilters = useMemo(() => {
    if (searchInput) {
      return true;
    }
    for (const def of config.filters ?? []) {
      const value = filters[def.id];
      const fallback = def.default ?? "";
      if (value !== fallback) {
        return true;
      }
    }
    return false;
  }, [searchInput, filters, config.filters]);

  return {
    searchInput,
    setSearchInput,
    search: debouncedSearch,
    filters,
    setFilters,
    setFilter,
    clearFilters,
    hasActiveFilters,
    sort,
    urlSort,
    setSortField,
    setSortDirection,
    clearSort,
    page,
    pageSize,
    setPage,
    setPageSize,
  };
}
