import { fetchAccountFileBlob } from "@web/utils/api/routes/accounts";
import type {
  BalanceGapStatus,
  CoverageGap,
  CoverageSegment,
  MonthAvailability,
  StatementFormat,
} from "@web/utils/api/routes/accounts/types";
import {
  addDaysToAccountDate,
  compareAccountDates,
  formatAccountDateRangeLabel,
  inclusiveDaysBetweenAccountDates,
} from "@web/utils/time";
import type { RefObject } from "react";

export function monthFormatIsAvailable(
  availability: MonthAvailability | undefined,
  format: StatementFormat
): boolean {
  return availability?.formats.includes(format) ?? false;
}

export function monthCsvDownloadFormat(
  availability: MonthAvailability | undefined
): StatementFormat | null {
  if (monthFormatIsAvailable(availability, "csv")) {
    return "csv";
  }
  if (monthFormatIsAvailable(availability, "transactions")) {
    return "transactions";
  }
  return null;
}

export function monthCsvIsViewable(availability: MonthAvailability | undefined): boolean {
  return monthCsvDownloadFormat(availability) !== null;
}

export const UPLOAD_ACCEPT: Record<"pdf" | "csv", string> = {
  pdf: ".pdf,application/pdf",
  csv: ".csv,text/csv",
};

export type PendingUpload =
  | { kind: "monthly"; month: string; format: "pdf" | "csv" }
  | { kind: "annual"; yearKey: string; format: "pdf" | "csv" };

type OpenTextFileViewer = (params: {
  title: string;
  url: string;
  downloadFilename: string;
  format: "text";
}) => void;

export async function openAccountStatementFile(params: {
  accountId: string;
  statementDate: string;
  format: StatementFormat;
  titleLabel: string;
  openTextFile: OpenTextFileViewer;
}): Promise<void> {
  const { accountId, statementDate, format, titleLabel, openTextFile } = params;
  const blob = await fetchAccountFileBlob({
    accountId,
    statementDate,
    format,
  });
  const fileUrl = URL.createObjectURL(blob);

  if (format === "pdf") {
    window.open(fileUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const formatLabel = format.toUpperCase();
  openTextFile({
    title: `${titleLabel} · ${formatLabel}`,
    url: fileUrl,
    downloadFilename: `${statementDate}.${format}`,
    format: "text",
  });
}

export function prepareUploadFileInput(
  fileInputRef: RefObject<HTMLInputElement | null>,
  format: "pdf" | "csv"
): void {
  if (!fileInputRef.current) {
    return;
  }
  fileInputRef.current.accept = UPLOAD_ACCEPT[format];
  fileInputRef.current.value = "";
  fileInputRef.current.click();
}

/**
 * Shared coverage color tokens for two UIs:
 * - Year calendar (`monthCellClassName`) — pastel cells from `balance_gaps` month status
 *   (matched / mismatched / discontinuity) plus file availability.
 * - Coverage timeline bar (`COVERAGE_COVERED_BAR_CLASS` / `coverageGapBarClass`) — saturated
 *   fills from `period_covered` date-range gaps (`balances_match` only; no discontinuity).
 */

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

type TimelineRange = {
  start: string;
  end: string;
};

type CoverageTimelineItem =
  | ({ type: "covered" } & TimelineRange & { days: number })
  | ({
      type: "gap";
      balancesMatch?: boolean | null;
    } & TimelineRange & { days: number });

function withDays<T extends TimelineRange>(item: T): T & { days: number } {
  return {
    ...item,
    days: inclusiveDaysBetweenAccountDates(item.start, item.end),
  };
}

function buildStatementTimelineItems(
  segments: CoverageSegment[],
  gaps: CoverageGap[]
): CoverageTimelineItem[] {
  const items: CoverageTimelineItem[] = [];
  for (let index = 0; index < segments.length; index += 1) {
    if (index > 0 && gaps[index - 1]) {
      const gap = gaps[index - 1];
      items.push(
        withDays({
          type: "gap",
          start: gap.start,
          end: gap.end,
          balancesMatch: gap.balancesMatch,
        })
      );
    }
    const segment = segments[index];
    items.push(
      withDays({
        type: "covered",
        start: segment.start,
        end: segment.end,
      })
    );
  }
  return items;
}

export function buildFullCoverageTimelineItems(
  timelineStart: string,
  timelineEnd: string,
  segments: CoverageSegment[],
  gaps: CoverageGap[]
): CoverageTimelineItem[] {
  if (segments.length === 0) {
    return [];
  }

  const items: CoverageTimelineItem[] = [];
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  const dayAfterStart = addDaysToAccountDate(timelineStart, 1);

  if (dayAfterStart && compareAccountDates(firstSegment.start, dayAfterStart) > 0) {
    const leadingEnd = addDaysToAccountDate(firstSegment.start, -1);
    if (leadingEnd) {
      items.push(withDays({ type: "gap", start: timelineStart, end: leadingEnd }));
    }
  }

  items.push(...buildStatementTimelineItems(segments, gaps));

  const dayBeforeEnd = addDaysToAccountDate(timelineEnd, -1);
  if (dayBeforeEnd && compareAccountDates(lastSegment.end, dayBeforeEnd) < 0) {
    const trailingStart = addDaysToAccountDate(lastSegment.end, 1);
    if (trailingStart) {
      items.push(withDays({ type: "gap", start: trailingStart, end: timelineEnd }));
    }
  }

  return items;
}

export function countCoverageGaps(items: CoverageTimelineItem[]): number {
  return items.filter((item) => item.type === "gap").length;
}

export function timelineItemLabel(item: CoverageTimelineItem): string {
  const range = formatAccountDateRangeLabel(item.start, item.end);
  if (item.type === "covered") {
    return `${range} · Covered`;
  }
  if (item.balancesMatch === true) {
    return `${range} · Missing Statement · Balances Match`;
  }
  if (item.balancesMatch === false) {
    return `${range} · Missing Statement · Balance Mismatch`;
  }
  return `${range} · Missing statement`;
}
