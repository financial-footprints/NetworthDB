import type { CoverageGap, CoverageSegment } from "@web/utils/api/endpoints/accounts/types";
import {
  addDaysToAccountDate,
  compareAccountDates,
  formatAccountDateRangeLabel,
  inclusiveDaysBetweenAccountDates,
} from "@web/utils/time";

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
          balancesMatch: gap.balances_match,
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
