export type SortDirection = "asc" | "desc";

export type Pagination = {
  limit: number;
  offset: number;
};

export type Sort<Column extends string> = {
  column: Column;
  direction: SortDirection;
};

export const ONE: Pagination = { limit: 1, offset: 0 };

export async function findFirst<T, Filters, Column extends string>(
  findByFilters: (filters: Filters, sort?: Sort<Column>, pagination?: Pagination) => Promise<T[]>,
  filters: Filters,
  sort?: Sort<Column>
): Promise<T | null> {
  const rows = await findByFilters(filters, sort, ONE);
  return rows[0] ?? null;
}
