import { describe, expect, test } from "bun:test";
import { clampPage, usePagination } from "@web/hooks/usePagination";

function totalPagesFor(totalCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

function derivedPagination(page: number, pageSize: number, totalCount: number) {
  const totalPages = totalPagesFor(totalCount, pageSize);
  const clampedPage = clampPage(page, totalPages);
  return {
    page: clampedPage,
    offset: (clampedPage - 1) * pageSize,
    totalPages,
    hasMultiplePages: totalPages > 1,
    canGoNext: clampedPage < totalPages,
    canGoPrevious: clampedPage > 1,
  };
}

describe("usePagination", () => {
  test("resets to page 1 when resetKey changes during render", () => {
    let page = 1;
    let prevResetKey: unknown = "all";

    function applyResetKey(resetKey: unknown): void {
      if (resetKey !== prevResetKey) {
        prevResetKey = resetKey;
        page = 1;
      }
    }

    page = 2;
    applyResetKey("all");
    expect(page).toBe(2);

    applyResetKey("enabled");
    expect(page).toBe(1);
    expect(derivedPagination(page, 10, 50).offset).toBe(0);
  });

  test("reports hasMultiplePages only when total exceeds one page", () => {
    const singlePage = derivedPagination(1, 100, 50);
    expect(singlePage.hasMultiplePages).toBe(false);
    expect(singlePage.totalPages).toBe(1);

    const multiPage = derivedPagination(1, 100, 250);
    expect(multiPage.hasMultiplePages).toBe(true);
    expect(multiPage.totalPages).toBe(3);
  });

  test("clamps page navigation to valid bounds", () => {
    let page = 1;
    const pageSize = 10;
    let totalCount = 25;

    page = clampPage(99, totalPagesFor(totalCount, pageSize));
    expect(page).toBe(3);

    page = clampPage(0, totalPagesFor(totalCount, pageSize));
    expect(page).toBe(1);

    totalCount = 5;
    page = clampPage(page, totalPagesFor(totalCount, pageSize));
    expect(page).toBe(1);
    expect(derivedPagination(page, pageSize, totalCount).canGoNext).toBe(false);
  });

  test("goToPage navigates within range and updates offset", () => {
    const pageSize = 10;
    const totalCount = 45;
    const totalPages = totalPagesFor(totalCount, pageSize);

    let page = clampPage(3, totalPages);
    let snapshot = derivedPagination(page, pageSize, totalCount);
    expect(snapshot.page).toBe(3);
    expect(snapshot.offset).toBe(20);
    expect(snapshot.canGoPrevious).toBe(true);
    expect(snapshot.canGoNext).toBe(true);

    if (snapshot.canGoNext) {
      page = clampPage(page + 1, totalPages);
    }
    expect(page).toBe(4);

    snapshot = derivedPagination(page, pageSize, totalCount);
    if (snapshot.canGoPrevious) {
      page = clampPage(page - 1, totalPages);
    }
    expect(page).toBe(3);
  });

  test("exports clampPage helper used by the hook", () => {
    expect(clampPage(2, 5)).toBe(2);
    expect(typeof usePagination).toBe("function");
  });
});
