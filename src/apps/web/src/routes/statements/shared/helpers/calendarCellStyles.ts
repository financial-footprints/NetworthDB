/**
 * Shared coverage color tokens for two UIs:
 * - Year calendar (`monthCellClassName`) — pastel cells from `balance_gaps` month status
 *   (matched / mismatched / discontinuity) plus file availability.
 * - Coverage timeline bar (`COVERAGE_COVERED_BAR_CLASS` / `coverageGapBarClass`) — saturated
 *   fills from `period_covered` date-range gaps (`balances_match` only; no discontinuity).
 */
import type { BalanceGapStatus } from "@web/utils/api/endpoints/accounts/types";

export const COVERAGE_COVERED_BAR_CLASS = "coverage-bar-covered";

export function coverageGapBarClass(balancesMatch: boolean | null | undefined): string {
  if (balancesMatch === true) {
    return "coverage-bar-gap-matched";
  }
  return "coverage-bar-gap";
}

export const CALENDAR_LEGEND_ITEMS = [
  {
    swatch: "calendar-swatch-files",
    label: "Statement files are present",
  },
  {
    swatch: "calendar-swatch-annual",
    label: "No monthly file; covered by annual statement",
  },
  {
    swatch: "calendar-swatch-missing",
    label: "No statement for this month",
  },
  {
    swatch: "calendar-swatch-matched",
    label: "Missing month(s): Possible activity in previous months",
  },
  {
    swatch: "calendar-swatch-mismatched",
    label: "Missing month(s): Activity without a statement",
  },
  {
    swatch: "calendar-swatch-discontinuity",
    label: "Neighbor months: prior closing ≠ next opening",
  },
] as const;

export function monthCellClassName(
  inRange: boolean,
  hasFiles: boolean,
  balanceGapStatus: BalanceGapStatus | undefined,
  hasAnnualStatement = false
): string {
  if (!inRange) {
    return "calendar-cell-out-of-range";
  }
  if (balanceGapStatus === "discontinuity") {
    return "calendar-cell-discontinuity";
  }
  if (hasFiles) {
    return "calendar-cell-files";
  }
  if (balanceGapStatus === "matched") {
    return "calendar-cell-matched";
  }
  if (balanceGapStatus === "mismatched") {
    return "calendar-cell-mismatched";
  }
  if (hasAnnualStatement) {
    return "calendar-cell-annual";
  }
  return "calendar-cell-missing";
}
