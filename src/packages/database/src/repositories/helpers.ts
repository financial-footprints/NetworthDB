import type { Pagination, Sort } from "@ndb/core";
import { type AnyColumn, asc, desc, type SQL } from "drizzle-orm";

export type TextColumnEncoding = "utf8" | "base64url";

export function bufferToText<T extends Buffer | null, U extends string | null>(
  value: T,
  encoding: TextColumnEncoding
): U {
  if (value === null) {
    return null as U;
  }

  return value.toString(encoding) as U;
}

export function textToBuffer<T extends string | null, U extends Buffer | null>(
  value: T,
  encoding: TextColumnEncoding
): U {
  if (value === null) {
    return null as U;
  }

  return Buffer.from(value, encoding) as U;
}

export function applySort<Column extends string>(
  columnMap: Record<Column, AnyColumn>,
  sort?: Sort<Column>
): SQL | undefined {
  if (!sort) {
    return undefined;
  }

  const column = columnMap[sort.column];
  return sort.direction === "desc" ? desc(column) : asc(column);
}

export function applyPagination<T extends { limit: (n: number) => T; offset: (n: number) => T }>(
  query: T,
  pagination?: Pagination
): T {
  if (!pagination) {
    return query;
  }

  return query.limit(pagination.limit).offset(pagination.offset);
}

export function isUniqueViolation(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "code" in error) {
    if ((error as { code: unknown }).code === "23505") {
      return true;
    }
  }

  if (typeof error === "object" && error !== null && "cause" in error) {
    return isUniqueViolation((error as { cause: unknown }).cause);
  }

  return false;
}
