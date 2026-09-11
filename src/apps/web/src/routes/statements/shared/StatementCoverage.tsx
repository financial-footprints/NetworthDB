import { ActionButton } from "@web/components/button";
import {
  COVERAGE_COVERED_BAR_CLASS,
  coverageGapBarClass,
} from "@web/routes/statements/shared/helpers/calendarCellStyles";
import {
  buildFullCoverageTimelineItems,
  countCoverageGaps,
  timelineItemLabel,
} from "@web/routes/statements/shared/helpers/coverageTimeline";
import type {
  CalendarEndSource,
  StatementCoverage as StatementCoverageData,
} from "@web/utils/api/endpoints/accounts/types";
import {
  formatAccountDateLabel,
  inclusiveDaysBetweenAccountDates,
  parseAccountDate,
  todayAccountDate,
} from "@web/utils/time";
import { FaCheckCircle } from "react-icons/fa";
import "@web/assets/styles/calendar.css";

type StatementCoverageProps = {
  periodCovered: StatementCoverageData;
  statementCount: number;
  calendarStart: string | null;
  calendarEnd: string | null;
  calendarEndSource: CalendarEndSource | null;
  metadataUrl?: string;
  onOpenMetadata?: () => void;
};

function MetadataAction({
  metadataUrl,
  onOpenMetadata,
}: {
  metadataUrl?: string;
  onOpenMetadata?: () => void;
}) {
  if (!metadataUrl || !onOpenMetadata) {
    return null;
  }

  return <ActionButton onClick={onOpenMetadata}>Metadata</ActionButton>;
}

function CoverageFooter({
  statementCount,
  metadataUrl,
  onOpenMetadata,
}: {
  statementCount: number;
  metadataUrl?: string;
  onOpenMetadata?: () => void;
}) {
  if (statementCount > 0) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500">Statements: {statementCount}</p>
        <MetadataAction metadataUrl={metadataUrl} onOpenMetadata={onOpenMetadata} />
      </div>
    );
  }

  if (!metadataUrl || !onOpenMetadata) {
    return null;
  }

  return (
    <div className="flex justify-end">
      <MetadataAction metadataUrl={metadataUrl} onOpenMetadata={onOpenMetadata} />
    </div>
  );
}

function resolveTimelineEnd(
  calendarEnd: string | null,
  calendarEndSource: CalendarEndSource | null
): string | null {
  if (!calendarEnd) {
    return null;
  }
  if (calendarEndSource === "today") {
    return todayAccountDate();
  }
  return parseAccountDate(calendarEnd) ? calendarEnd : null;
}

function resolveTimelineStart(calendarStart: string | null): string | null {
  if (!calendarStart) {
    return null;
  }
  return parseAccountDate(calendarStart) ? calendarStart : null;
}

function CoverageTimelineBar({
  timelineStart,
  timelineEnd,
  items,
  totalDays,
  gapCount,
}: {
  timelineStart: string;
  timelineEnd: string;
  items: ReturnType<typeof buildFullCoverageTimelineItems>;
  totalDays: number;
  gapCount: number;
}) {
  const hasNoGaps = gapCount === 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-900">Statement Coverage</p>
        {hasNoGaps ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
            <FaCheckCircle aria-hidden className="h-4 w-4" />
            No gaps
          </span>
        ) : (
          <span className="text-sm text-amber-700">
            {gapCount} {gapCount === 1 ? "gap" : "gaps"}
          </span>
        )}
      </div>

      {totalDays > 0 ? (
        <div className="space-y-2">
          <div
            className="flex h-3 gap-px overflow-hidden rounded-full bg-slate-200"
            role="img"
            aria-label={`Coverage from ${formatAccountDateLabel(timelineStart)} to ${formatAccountDateLabel(timelineEnd)}`}
          >
            {items.map((item) => {
              const widthPercent = Math.max((item.days / totalDays) * 100, 0.5);
              return (
                <div
                  key={`${item.type}:${item.start}:${item.end}`}
                  className={
                    item.type === "covered"
                      ? COVERAGE_COVERED_BAR_CLASS
                      : coverageGapBarClass(item.balancesMatch)
                  }
                  style={{ width: `${widthPercent}%` }}
                  title={timelineItemLabel(item)}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>{formatAccountDateLabel(timelineStart)}</span>
            <span>{formatAccountDateLabel(timelineEnd)}</span>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function StatementCoverage({
  periodCovered,
  statementCount,
  calendarStart,
  calendarEnd,
  calendarEndSource,
  metadataUrl,
  onOpenMetadata,
}: StatementCoverageProps) {
  const segments = periodCovered.segments ?? [];
  const gaps = periodCovered.gaps ?? [];
  const timelineStart = resolveTimelineStart(calendarStart);
  const timelineEnd = resolveTimelineEnd(calendarEnd, calendarEndSource);
  const canDrawBar = segments.length > 0 && timelineStart !== null && timelineEnd !== null;

  const items = canDrawBar
    ? buildFullCoverageTimelineItems(timelineStart, timelineEnd, segments, gaps)
    : [];
  const totalDays =
    canDrawBar && timelineStart && timelineEnd
      ? inclusiveDaysBetweenAccountDates(timelineStart, timelineEnd)
      : 0;
  const gapCount = canDrawBar ? countCoverageGaps(items) : 0;

  return (
    <section>
      {statementCount === 0 ? (
        <h3 className="text-lg font-semibold text-slate-900">Statement Coverage</h3>
      ) : null}
      <div className={statementCount === 0 ? "mt-4 space-y-3" : "space-y-3"}>
        {statementCount === 0 ? (
          <p className="text-sm text-slate-500">
            No statements synced yet. Run sync to download statement files.
          </p>
        ) : null}

        {canDrawBar && timelineStart && timelineEnd ? (
          <CoverageTimelineBar
            timelineStart={timelineStart}
            timelineEnd={timelineEnd}
            items={items}
            totalDays={totalDays}
            gapCount={gapCount}
          />
        ) : null}

        <CoverageFooter
          statementCount={statementCount}
          metadataUrl={metadataUrl}
          onOpenMetadata={onOpenMetadata}
        />
      </div>
    </section>
  );
}
