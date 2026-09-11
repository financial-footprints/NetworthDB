import { SecondaryButton } from "@web/components/button";
import { clampPage, type PaginationState } from "@web/hooks/usePagination";
import { type KeyboardEvent, useEffect, useState } from "react";

type PaginationControlsProps = {
  pagination: PaginationState;
};

export function PaginationControls({ pagination }: PaginationControlsProps) {
  const {
    page,
    totalPages,
    hasMultiplePages,
    canGoNext,
    canGoPrevious,
    goToNextPage,
    goToPreviousPage,
    goToPage,
  } = pagination;
  const [jumpValue, setJumpValue] = useState(String(page));

  useEffect(() => {
    setJumpValue(String(page));
  }, [page]);

  if (!hasMultiplePages) {
    return null;
  }

  function handleJumpBlur(): void {
    const parsed = Number(jumpValue);
    if (!Number.isFinite(parsed)) {
      setJumpValue(String(page));
      return;
    }
    const target = clampPage(parsed, totalPages);
    goToPage(target);
    setJumpValue(String(target));
  }

  function handleJumpKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 pt-4">
      <span className="text-sm text-slate-600">
        Page {page} of {totalPages}
      </span>

      <div className="flex items-center gap-2">
        <SecondaryButton onClick={goToPreviousPage} disabled={!canGoPrevious}>
          Previous
        </SecondaryButton>

        <input
          type="number"
          min={1}
          max={totalPages}
          value={jumpValue}
          onChange={(event) => setJumpValue(event.target.value)}
          onBlur={handleJumpBlur}
          onKeyDown={handleJumpKeyDown}
          className="form-input form-input-no-spinner w-20"
          aria-label="Page number"
        />

        <SecondaryButton onClick={goToNextPage} disabled={!canGoNext}>
          Next
        </SecondaryButton>
      </div>
    </div>
  );
}
