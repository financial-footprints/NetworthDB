import { serializeAccountData } from "@api/routes/accounts/serializer";
import type { MetadataResult } from "@ndb/core";
import { accountDetailsSchema } from "@ndb/platform";

export function serializeAccountDetails(metadata: MetadataResult, includeSecrets: boolean) {
  const { statements } = metadata;

  return accountDetailsSchema.parse({
    data: {
      account: serializeAccountData(metadata.account, includeSecrets),
      calendarStart: metadata.calendarStart,
      calendarEnd: metadata.calendarEnd,
      calendarEndSource: metadata.calendarEndSource,
      closingDateConfigured: metadata.closingDateConfigured,
      calendarYearSections: metadata.calendarYearSections.map((section) => ({
        yearKey: section.yearKey,
        label: section.label,
        months: section.months.map((month) => ({
          month: month.month,
          year: month.year,
          monthKey: month.monthKey,
        })),
      })),
      statements: {
        available: statements.available,
        statementCount: statements.statementCount,
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
            balancesMatch: gap.balancesMatch ?? null,
          })),
          months: statements.coverage.months,
          periodCount: statements.coverage.periodCount,
        },
        statements: statements.statements.map((statement) => ({
          accountId: statement.accountId,
          kind: statement.kind,
          period: statement.period,
          statementDate: statement.statementDate,
          formats: statement.formats,
          periodStart: statement.periodStart,
          periodEnd: statement.periodEnd,
          transactionsSynced: statement.transactionsSynced,
          transactionsImportId: statement.transactionsImportId,
        })),
        balanceGaps: statements.balanceGaps,
      },
    },
  });
}
