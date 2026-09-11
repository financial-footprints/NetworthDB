import { serializeAccountData } from "@api/routes/accounts/serializer";
import type { MetadataResult } from "@ndb/core";
import { accountDetailsSchema } from "@ndb/platform";

export function serializeAccountDetails(metadata: MetadataResult, includeSecrets: boolean) {
  const { statements } = metadata;

  return accountDetailsSchema.parse({
    data: {
      account: serializeAccountData(metadata.account, includeSecrets),
      calendar_start: metadata.calendarStart,
      calendar_end: metadata.calendarEnd,
      calendar_end_source: metadata.calendarEndSource,
      closing_date_configured: metadata.closingDateConfigured,
      calendar_year_sections: metadata.calendarYearSections.map((section) => ({
        year_key: section.yearKey,
        label: section.label,
        months: section.months.map((month) => ({
          month: month.month,
          year: month.year,
          month_key: month.monthKey,
        })),
      })),
      statements: {
        available: statements.available,
        statement_count: statements.statementCount,
        starting: statements.starting ?? null,
        ending: statements.ending ?? null,
        formats: statements.formats,
        coverage: {
          start: statements.coverage.start ?? null,
          end: statements.coverage.end ?? null,
          segments: statements.coverage.segments,
          gaps: statements.coverage.gaps.map((gap) => ({
            start: gap.start,
            end: gap.end,
            balances_match: gap.balancesMatch ?? null,
          })),
          months: statements.coverage.months,
          period_count: statements.coverage.periodCount,
        },
        statements: statements.statements.map((statement) => ({
          account_id: statement.accountId,
          kind: statement.kind,
          period: statement.period,
          statement_date: statement.statementDate,
          formats: statement.formats,
          period_start: statement.periodStart,
          period_end: statement.periodEnd,
        })),
        balance_gaps: statements.balanceGaps,
      },
    },
    errors: [],
  });
}
