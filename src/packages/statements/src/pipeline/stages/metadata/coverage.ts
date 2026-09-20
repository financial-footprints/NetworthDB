import { balancesMatch } from "@statements/banks/helpers/index";
import { formatAccountDate, parseAccountDateStr } from "@statements/period/account-dates";
import { isAnnualPeriod, isFyPeriod, periodForYearKey } from "@statements/period/statement-period";
import type {
  CoverageGap,
  CoverageSegment,
  PeriodCovered,
  StatementMetadata,
} from "@statements/pipeline/stages/metadata/stored";
import { addDays, parseISO } from "date-fns";

export function coveredMonth(statementDate: string): string {
  if (isAnnualPeriod(statementDate)) {
    const yearDisplay = isFyPeriod(statementDate) ? "fiscal_year" : "calendar_year";
    const bounds = periodForYearKey(statementDate, yearDisplay);
    const start = parseISO(bounds.start);
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  }

  const parts = statementDate.split("-");
  if (parts.length !== 2) {
    return statementDate;
  }
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

export function nextMonthKey(month: string): string {
  const parts = month.split("-");
  if (parts.length !== 2) {
    return month;
  }
  const year = Number(parts[0]);
  const monthNum = Number(parts[1]);
  if (monthNum === 12) {
    return `${year + 1}-01`;
  }
  return `${year}-${String(monthNum + 1).padStart(2, "0")}`;
}

export function monthsBetweenExclusive(start: string, end: string): string[] {
  if (start >= end) {
    return [];
  }
  const months: string[] = [];
  let current = nextMonthKey(start);
  while (current < end) {
    months.push(current);
    current = nextMonthKey(current);
  }
  return months;
}

function gapsBetweenMonthlyStatements(
  previous: StatementMetadata,
  following: StatementMetadata,
  annualCovered: Set<string>,
  tolerance?: number
): Array<[string, string]> {
  const previousCovered = coveredMonth(previous.statement_date);
  const followingCovered = coveredMonth(following.statement_date);
  const between = monthsBetweenExclusive(previousCovered, followingCovered);
  const closing = previous.closing_balance;
  const opening = following.opening_balance;
  if (!closing || !opening) {
    return [];
  }

  if (between.length > 0) {
    const status = balancesMatch(closing, opening, tolerance) ? "matched" : "mismatched";
    const gaps: Array<[string, string]> = [];
    for (const month of between) {
      if (!annualCovered.has(month)) {
        gaps.push([month, status]);
      }
    }
    return gaps;
  }

  if (
    followingCovered === nextMonthKey(previousCovered) &&
    !balancesMatch(closing, opening, tolerance)
  ) {
    return [
      [previousCovered, "discontinuity"],
      [followingCovered, "discontinuity"],
    ];
  }

  return [];
}

export function computeBalanceGaps(
  statements: StatementMetadata[],
  tolerance?: number
): Array<[string, string]> {
  const annualCovered = new Set(
    statements
      .filter((statement) => statement.granularity === "annual")
      .flatMap((statement) => statement.covered_months)
  );

  const monthlyStatements = statements.filter((statement) => statement.granularity === "monthly");
  if (monthlyStatements.length < 2) {
    return [];
  }

  monthlyStatements.sort((a, b) =>
    coveredMonth(a.statement_date).localeCompare(coveredMonth(b.statement_date))
  );
  const gaps: Array<[string, string]> = [];

  for (let index = 0; index < monthlyStatements.length - 1; index += 1) {
    const previous = monthlyStatements[index];
    const following = monthlyStatements[index + 1];
    if (!previous || !following) {
      continue;
    }
    gaps.push(...gapsBetweenMonthlyStatements(previous, following, annualCovered, tolerance));
  }

  return gaps;
}

function mergeCoveragePeriods(
  periods: Array<[Date, Date, boolean]>
): [Array<[Date, Date, boolean]>, Array<[Date, Date]>] {
  if (periods.length === 0) {
    return [[], []];
  }

  const sorted = [...periods].sort((a, b) => a[0].getTime() - b[0].getTime());
  const segments: Array<[Date, Date, boolean]> = [];
  const gaps: Array<[Date, Date]> = [];
  let [currentStart, currentEnd, currentApproximate] = sorted[0] as [Date, Date, boolean];

  for (const [start, end, approximate] of sorted.slice(1)) {
    if (start.getTime() <= addDays(currentEnd, 1).getTime()) {
      if (end > currentEnd) {
        currentEnd = end;
      }
      currentApproximate = currentApproximate || approximate;
      continue;
    }
    segments.push([currentStart, currentEnd, currentApproximate]);
    const gapStart = addDays(currentEnd, 1);
    const gapEnd = addDays(start, -1);
    if (gapStart <= gapEnd) {
      gaps.push([gapStart, gapEnd]);
    }
    currentStart = start;
    currentEnd = end;
    currentApproximate = approximate;
  }

  segments.push([currentStart, currentEnd, currentApproximate]);
  return [segments, gaps];
}

function collectCoveredMonthKeys(statements: StatementMetadata[]): string[] {
  const months = new Set<string>();
  for (const statement of statements) {
    if (statement.granularity === "monthly") {
      months.add(coveredMonth(statement.statement_date));
    }
    if (statement.granularity === "annual") {
      for (const month of statement.covered_months) {
        months.add(month);
      }
    }
  }
  return [...months].sort();
}

function collectPeriodTuples(statements: StatementMetadata[]): {
  periods: Array<[Date, Date, boolean]>;
  periodCount: number;
} {
  const periods: Array<[Date, Date, boolean]> = [];
  let periodCount = 0;

  for (const statement of statements) {
    if (statement.period_approximate) {
      periodCount += 1;
    }
    if (statement.period_start && statement.period_end) {
      const startDate = parseAccountDateStr(statement.period_start);
      const endDate = parseAccountDateStr(statement.period_end);
      if (startDate && endDate) {
        periods.push([startDate, endDate, statement.period_approximate]);
      }
    }
  }

  return { periods, periodCount };
}

export function buildPeriodCovered(statements: StatementMetadata[]): PeriodCovered {
  const monthsVec = collectCoveredMonthKeys(statements);
  const { periods, periodCount } = collectPeriodTuples(statements);

  if (periods.length === 0) {
    return {
      start: null,
      end: null,
      segments: [],
      gaps: [],
      months: monthsVec,
      period_count: periodCount,
    };
  }

  const [mergedSegments, mergedGaps] = mergeCoveragePeriods(periods);
  const segments: CoverageSegment[] = mergedSegments.map(([start, end, approximate]) => ({
    start: formatAccountDate(start),
    end: formatAccountDate(end),
    approximate,
  }));

  const gaps: CoverageGap[] = mergedGaps.map(([start, end]) => ({
    start: formatAccountDate(start),
    end: formatAccountDate(end),
    balances_match: null,
  }));

  return {
    start: segments[0]?.start ?? null,
    end: segments.at(-1)?.end ?? null,
    segments,
    gaps,
    months: monthsVec,
    period_count: periodCount,
  };
}
