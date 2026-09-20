import type { Pagination, Sort } from "@ndb/core";
import { type AnyColumn, asc, desc, type SQL } from "drizzle-orm";

export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

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

export function applyPagination<
  T extends { limit: (n: number) => unknown; offset: (n: number) => unknown },
>(query: T, pagination?: Pagination): T {
  if (!pagination) {
    return query;
  }

  const limited = query.limit(pagination.limit) as T;
  return limited.offset(pagination.offset) as unknown as T;
}

/** Default concurrent read fan-out; matches deployed pool ceiling. */
export const DB_READ_CONCURRENCY = 10;

/**
 * Run independent async work with a concurrency limit.
 *
 * Pass thunks (not already-started promises) so later tasks wait for a free slot.
 * Two-query list+count pairs can stay as `Promise.all`.
 */
export async function parallelize<const TTasks extends readonly (() => Promise<unknown>)[]>(
  tasks: TTasks,
  concurrency: number = DB_READ_CONCURRENCY
): Promise<{ [K in keyof TTasks]: Awaited<ReturnType<TTasks[K]>> }> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(`database.parallelize.invalid-concurrency.${concurrency}`);
  }

  if (tasks.length === 0) {
    return [] as { [K in keyof TTasks]: Awaited<ReturnType<TTasks[K]>> };
  }

  const results: unknown[] = Array.from({ length: tasks.length });
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= tasks.length) {
        return;
      }

      const task = tasks[index];
      if (!task) {
        continue;
      }

      results[index] = await task();
    }
  }

  const workerCount = Math.min(concurrency, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results as { [K in keyof TTasks]: Awaited<ReturnType<TTasks[K]>> };
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
