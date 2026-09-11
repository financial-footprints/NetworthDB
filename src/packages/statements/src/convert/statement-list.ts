import type { Statement, StatementList } from "@ndb/core";
import type {
  StatementKind as NativeStatementKind,
  StatementList as NativeStatementList,
} from "../../native.d.ts";

const NATIVE_ANNUAL = 1;

const toDomainStatementKind = (kind: NativeStatementKind): Statement["kind"] =>
  kind === NATIVE_ANNUAL ? "annual" : "monthly";

export const statementList = {
  toDomain: (list: NativeStatementList): StatementList => ({
    available: list.available,
    statementCount: list.statementCount,
    starting: list.starting ?? undefined,
    ending: list.ending ?? undefined,
    formats: [...list.formats],
    coverage: {
      start: list.coverage.start ?? undefined,
      end: list.coverage.end ?? undefined,
      segments: list.coverage.segments.map((segment) => ({
        start: segment.start,
        end: segment.end,
        approximate: segment.approximate ?? undefined,
      })),
      gaps: list.coverage.gaps.map((gap) => ({
        start: gap.start,
        end: gap.end,
        balancesMatch: gap.balancesMatch ?? undefined,
      })),
      months: [...list.coverage.months],
      periodCount: list.coverage.periodCount,
    },
    statements: list.statements.map((statement) => ({
      accountId: statement.accountId,
      kind: toDomainStatementKind(statement.kind),
      period: statement.period,
      statementDate: statement.statementDate,
      formats: [...statement.formats],
      periodStart: statement.periodStart ?? null,
      periodEnd: statement.periodEnd ?? null,
    })),
    balanceGaps: list.balanceGaps.map((gap) => ({
      month: gap.month,
      status: gap.status,
    })),
  }),
};
