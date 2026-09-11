import { describe, expect, test } from "bun:test";
import { coverageGapBarClass } from "@web/routes/statements/shared/helpers/calendarCellStyles";
import {
  buildFullCoverageTimelineItems,
  countCoverageGaps,
  timelineItemLabel,
} from "@web/routes/statements/shared/helpers/coverageTimeline";
import { inclusiveDaysBetweenAccountDates } from "@web/utils/time";

function timelineItem(
  item:
    | { type: "covered"; start: string; end: string }
    | {
        type: "gap";
        start: string;
        end: string;
        balancesMatch?: boolean | null;
      }
) {
  return {
    ...item,
    days: inclusiveDaysBetweenAccountDates(item.start, item.end),
  };
}

describe("buildFullCoverageTimelineItems", () => {
  test("adds leading and trailing gaps around covered segment", () => {
    const items = buildFullCoverageTimelineItems(
      "01-04-2023",
      "11-07-2026",
      [{ start: "21-12-2023", end: "20-03-2026" }],
      []
    );

    expect(countCoverageGaps(items)).toBe(2);
    expect(items[0]).toEqual(
      timelineItem({
        type: "gap",
        start: "01-04-2023",
        end: "20-12-2023",
      })
    );
    expect(items[1]).toEqual(
      timelineItem({
        type: "covered",
        start: "21-12-2023",
        end: "20-03-2026",
      })
    );
    expect(items[2]).toEqual(
      timelineItem({
        type: "gap",
        start: "21-03-2026",
        end: "11-07-2026",
      })
    );
  });

  test("returns only covered items when segment spans timeline", () => {
    const items = buildFullCoverageTimelineItems(
      "21-12-2023",
      "20-03-2026",
      [{ start: "21-12-2023", end: "20-03-2026" }],
      []
    );

    expect(items).toEqual([
      timelineItem({
        type: "covered",
        start: "21-12-2023",
        end: "20-03-2026",
      }),
    ]);
    expect(countCoverageGaps(items)).toBe(0);
  });

  test("preserves balancesMatch on inter-segment gaps", () => {
    const items = buildFullCoverageTimelineItems(
      "21-12-2023",
      "20-05-2024",
      [
        { start: "21-12-2023", end: "20-01-2024" },
        { start: "21-04-2024", end: "20-05-2024" },
      ],
      [{ start: "21-01-2024", end: "20-04-2024", balances_match: true }]
    );

    expect(items).toEqual([
      timelineItem({
        type: "covered",
        start: "21-12-2023",
        end: "20-01-2024",
      }),
      timelineItem({
        type: "gap",
        start: "21-01-2024",
        end: "20-04-2024",
        balancesMatch: true,
      }),
      timelineItem({
        type: "covered",
        start: "21-04-2024",
        end: "20-05-2024",
      }),
    ]);
  });
});

describe("coverageGapBarClass", () => {
  test("uses medium blue for matched balance gaps", () => {
    expect(coverageGapBarClass(true)).toBe("coverage-bar-gap-matched");
  });

  test("uses medium amber for mismatched or unknown gaps", () => {
    expect(coverageGapBarClass(false)).toBe("coverage-bar-gap");
    expect(coverageGapBarClass(null)).toBe("coverage-bar-gap");
    expect(coverageGapBarClass(undefined)).toBe("coverage-bar-gap");
  });
});

describe("timelineItemLabel", () => {
  test("describes balance-matched gaps", () => {
    expect(
      timelineItemLabel({
        type: "gap",
        start: "21-01-2024",
        end: "20-04-2024",
        balancesMatch: true,
        days: inclusiveDaysBetweenAccountDates("21-01-2024", "20-04-2024"),
      })
    ).toBe("21 Jan 2024 – 20 Apr 2024 · Missing Statement · Balances Match");
  });
});
