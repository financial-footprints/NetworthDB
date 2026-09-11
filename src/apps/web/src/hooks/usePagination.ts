import { useRef, useState } from "react";

type UsePaginationOptions = {
  pageSize: number;
  totalCount: number;
  resetKey?: unknown;
};

export type PaginationState = {
  page: number;
  offset: number;
  totalPages: number;
  hasMultiplePages: boolean;
  canGoNext: boolean;
  canGoPrevious: boolean;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToPage: (page: number) => void;
};

export function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(1, page), totalPages);
}

export function usePagination({
  pageSize,
  totalCount,
  resetKey,
}: UsePaginationOptions): PaginationState {
  const [page, setPageState] = useState(1);
  const prevResetKeyRef = useRef(resetKey);
  const resetPending = resetKey !== prevResetKeyRef.current;

  if (resetPending) {
    prevResetKeyRef.current = resetKey;
    if (page !== 1) {
      setPageState(1);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const effectivePage = resetPending ? 1 : page;
  const clampedPage = clampPage(effectivePage, totalPages);

  if (!resetPending && page !== clampedPage) {
    setPageState(clampedPage);
  }

  const offset = (clampedPage - 1) * pageSize;
  const hasMultiplePages = totalPages > 1;
  const canGoNext = clampedPage < totalPages;
  const canGoPrevious = clampedPage > 1;

  function goToNextPage(): void {
    if (canGoNext) {
      setPageState(clampedPage + 1);
    }
  }

  function goToPreviousPage(): void {
    if (canGoPrevious) {
      setPageState(clampedPage - 1);
    }
  }

  function goToPage(targetPage: number): void {
    setPageState(clampPage(targetPage, totalPages));
  }

  return {
    page: clampedPage,
    offset,
    totalPages,
    hasMultiplePages,
    canGoNext,
    canGoPrevious,
    goToNextPage,
    goToPreviousPage,
    goToPage,
  };
}
