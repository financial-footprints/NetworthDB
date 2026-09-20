export type ListFilterDef<TFilterId extends string> = {
  id: TFilterId;
  urlKey: string;
  default?: string;
};

export type ListQueryConfig<TSortField extends string, TFilterId extends string> = {
  search?: { urlKey?: string };
  sort?: {
    urlKeys?: { field?: string; order?: string };
    fieldToUrl: Record<TSortField, string>;
    defaultSort: { field: TSortField; direction: "asc" | "desc" };
  };
  filters?: readonly ListFilterDef<TFilterId>[];
  pagination?: {
    pageKey?: string;
    pageSizeKey?: string;
    defaultPage?: number;
    defaultPageSize?: number;
  };
};
type UrlParamUpdates = Record<string, string | null | undefined>;

/**
 * Clone `current` and apply updates. `null` or `""` deletes the key;
 * `undefined` leaves it unchanged.
 */
export function patchUrlParams(
  current: URLSearchParams,
  updates: UrlParamUpdates
): URLSearchParams {
  const next = new URLSearchParams(current);

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      continue;
    }

    if (value === null || value === "") {
      next.delete(key);
      continue;
    }

    next.set(key, value);
  }

  return next;
}

export function readStringParam(params: URLSearchParams, key: string, fallback = ""): string {
  return params.get(key) ?? fallback;
}
export type SortDirection = "asc" | "desc";

export type SortState<TField extends string> = {
  field: TField;
  direction: SortDirection;
};

export type SortUrlKeys = {
  field?: string;
  order?: string;
};

const DEFAULT_FIELD_KEY = "sort";
const DEFAULT_ORDER_KEY = "direction";

function urlToFieldMap<TField extends string>(
  fieldToUrl: Record<TField, string>
): Record<string, TField> {
  return Object.fromEntries(
    Object.entries(fieldToUrl).map(([field, urlValue]) => [urlValue, field])
  ) as Record<string, TField>;
}

export function parseSortParam<TField extends string>(
  params: URLSearchParams,
  fieldToUrl: Record<TField, string>,
  urlKeys?: SortUrlKeys
): SortState<TField> | null {
  const fieldKey = urlKeys?.field ?? DEFAULT_FIELD_KEY;
  const orderKey = urlKeys?.order ?? DEFAULT_ORDER_KEY;
  const rawField = params.get(fieldKey);
  const rawOrder = params.get(orderKey);

  if (!rawField || !rawOrder) {
    return null;
  }

  const field = urlToFieldMap(fieldToUrl)[rawField];
  if (!field || (rawOrder !== "asc" && rawOrder !== "desc")) {
    return null;
  }

  return { field, direction: rawOrder };
}

export function encodeSortParamUpdates<TField extends string>(
  sort: SortState<TField> | null,
  fieldToUrl: Record<TField, string>,
  urlKeys?: SortUrlKeys
): Record<string, string | null> {
  const fieldKey = urlKeys?.field ?? DEFAULT_FIELD_KEY;
  const orderKey = urlKeys?.order ?? DEFAULT_ORDER_KEY;

  if (!sort) {
    return { [fieldKey]: null, [orderKey]: null };
  }

  return {
    [fieldKey]: fieldToUrl[sort.field],
    [orderKey]: sort.direction,
  };
}

export const searchQuery: ListQueryConfig<never, never> = {
  search: { urlKey: "q" },
};
