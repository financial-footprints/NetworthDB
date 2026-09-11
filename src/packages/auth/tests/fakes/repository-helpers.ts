import type { Pagination, Sort, SortDirection } from "@core/shared/query";

export function paginate<T>(items: T[], pagination?: Pagination): T[] {
  if (!pagination) {
    return items;
  }

  return items.slice(pagination.offset, pagination.offset + pagination.limit);
}

export function sortByColumn<T, Column extends string>(
  items: T[],
  accessors: Record<Column, (item: T) => string | number | Date>,
  sort?: Sort<Column>
): T[] {
  if (!sort) {
    return items;
  }

  const accessor = accessors[sort.column];
  const direction: SortDirection = sort.direction;
  return [...items].sort((left, right) => {
    const leftValue = accessor(left);
    const rightValue = accessor(right);
    const comparison =
      leftValue instanceof Date && rightValue instanceof Date
        ? leftValue.getTime() - rightValue.getTime()
        : String(leftValue).localeCompare(String(rightValue));
    return direction === "desc" ? -comparison : comparison;
  });
}
