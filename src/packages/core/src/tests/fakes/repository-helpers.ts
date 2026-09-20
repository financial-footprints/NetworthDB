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
    let comparison: number;
    if (leftValue instanceof Date && rightValue instanceof Date) {
      comparison = leftValue.getTime() - rightValue.getTime();
    } else if (typeof leftValue === "number" && typeof rightValue === "number") {
      comparison = leftValue - rightValue;
    } else {
      comparison = String(leftValue).localeCompare(String(rightValue));
    }
    return direction === "desc" ? -comparison : comparison;
  });
}
