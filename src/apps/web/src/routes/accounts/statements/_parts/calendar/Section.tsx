import { Legend } from "@web/routes/accounts/statements/_parts/calendar/Legend";
import {
  type AnnualFileSelection,
  type FileSelection,
  YearGrid,
} from "@web/routes/accounts/statements/_parts/calendar/YearGrid";
import type {
  AccountDetails,
  AnnualStatementAvailability,
  BalanceGapStatus,
  MonthAvailability,
} from "@web/utils/api/routes/accounts/types";
import type { MonthYear } from "@web/utils/time";

type CalendarSectionProps = {
  details: AccountDetails;
  calendarStart: MonthYear;
  calendarEnd: MonthYear;
  monthsByKey: ReadonlyMap<string, MonthAvailability>;
  annualStatementsByKey: ReadonlyMap<string, AnnualStatementAvailability>;
  balanceGapsByKey: ReadonlyMap<string, BalanceGapStatus>;
  uploadingKey: string | null;
  onSelectFile: (selection: FileSelection) => void;
  onSelectAnnualFile: (selection: AnnualFileSelection) => void;
};

export function Section({
  details,
  calendarStart,
  calendarEnd,
  monthsByKey,
  annualStatementsByKey,
  balanceGapsByKey,
  uploadingKey,
  onSelectFile,
  onSelectAnnualFile,
}: CalendarSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Legend />
      </div>
      {details.calendarYearSections.map((section) => (
        <YearGrid
          key={section.yearKey}
          section={section}
          rangeStart={calendarStart}
          rangeEnd={calendarEnd}
          monthsByKey={monthsByKey}
          coveredMonths={details.statements.coverage.months ?? []}
          accountClosed={details.closingDateConfigured}
          balanceGapsByKey={balanceGapsByKey}
          annualStatement={annualStatementsByKey.get(section.yearKey)}
          uploadingKey={uploadingKey}
          onSelectFile={onSelectFile}
          onSelectAnnualFile={onSelectAnnualFile}
        />
      ))}
    </div>
  );
}
