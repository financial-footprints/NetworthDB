import { Chip } from "@web/components/badge/Chip";
import { monthCellClassName } from "@web/routes/statements/shared/helpers/calendarCellStyles";
import { MonthTile, type MonthTileChip } from "@web/routes/statements/shared/MonthTile";
import type {
  AnnualStatementAvailability,
  BalanceGapStatus,
  CalendarYearSection,
  MonthAvailability,
  StatementFormat,
} from "@web/utils/api/endpoints/accounts/types";
import {
  formatYearMonthLabel,
  isMonthExpectingStatement,
  isMonthInRange,
  MONTH_LABELS,
  type MonthYear,
  statementDateForCoveredMonth,
} from "@web/utils/time";
import "@web/assets/styles/calendar.css";

export type FileSelection = {
  month: string;
  statementDate: string;
  format: StatementFormat;
  available: boolean;
};

export type AnnualFileSelection = {
  yearKey: string;
  statementDate: string;
  format: StatementFormat;
  available: boolean;
};

type YearCalendarGridProps = {
  section: CalendarYearSection;
  rangeStart: MonthYear;
  rangeEnd: MonthYear;
  monthsByKey: ReadonlyMap<string, MonthAvailability>;
  coveredMonths: readonly string[];
  accountClosed: boolean;
  balanceGapsByKey?: ReadonlyMap<string, BalanceGapStatus>;
  annualStatement?: AnnualStatementAvailability;
  uploadingKey?: string | null;
  onSelectFile: (selection: FileSelection) => void;
  onSelectAnnualFile: (selection: AnnualFileSelection) => void;
};

const UPLOADABLE_FORMATS = ["csv", "pdf"] as const;
const ANNUAL_FORMATS = ["csv", "pdf", "txt"] as const;

export function statementUploadKey(month: string, format: string): string {
  return `${month}:${format}`;
}

export function annualStatementUploadKey(yearKey: string, format: string): string {
  return `annual:${yearKey}:${format}`;
}

function formatIsAvailable(
  availability: MonthAvailability | undefined,
  format: StatementFormat
): boolean {
  return availability?.formats.includes(format) ?? false;
}

function annualFormatIsAvailable(
  annualStatement: AnnualStatementAvailability | undefined,
  format: StatementFormat
): boolean {
  return annualStatement?.formats.includes(format) ?? false;
}

function buildMonthChips(
  expectsStatement: boolean,
  availability: MonthAvailability | undefined,
  monthKey: string,
  statementDate: string,
  uploadingKey: string | null,
  onSelectFile: (selection: FileSelection) => void
): MonthTileChip[] {
  const chips: MonthTileChip[] = [];

  if (!expectsStatement) {
    return chips;
  }

  for (const format of UPLOADABLE_FORMATS) {
    chips.push({
      format,
      available: formatIsAvailable(availability, format),
      title: (() => {
        const formatLabel = format.toUpperCase();
        const monthLabel = formatYearMonthLabel(monthKey);
        const action = formatIsAvailable(availability, format) ? "View" : "Upload";
        const uploading = uploadingKey === statementUploadKey(monthKey, format);
        return uploading
          ? `Uploading ${formatLabel} for ${monthLabel}…`
          : `${action} ${formatLabel} for ${monthLabel}`;
      })(),
      uploading: uploadingKey === statementUploadKey(monthKey, format),
      onClick: () =>
        onSelectFile({
          month: monthKey,
          statementDate,
          format,
          available: formatIsAvailable(availability, format),
        }),
    });
  }

  if (formatIsAvailable(availability, "txt")) {
    chips.push({
      format: "txt",
      available: true,
      title: `View TXT for ${formatYearMonthLabel(monthKey)}`,
      uploading: false,
      onClick: () =>
        onSelectFile({
          month: monthKey,
          statementDate,
          format: "txt",
          available: true,
        }),
    });
  }

  return chips;
}

type YearMonthCellProps = {
  month: number;
  year: number;
  monthKey: string;
  rangeStart: MonthYear;
  rangeEnd: MonthYear;
  monthsByKey: ReadonlyMap<string, MonthAvailability>;
  coveredMonths: readonly string[];
  accountClosed: boolean;
  balanceGapsByKey?: ReadonlyMap<string, BalanceGapStatus>;
  hasAnnualStatement: boolean;
  uploadingKey: string | null;
  onSelectFile: (selection: FileSelection) => void;
};

function YearMonthCell({
  month,
  year,
  monthKey,
  rangeStart,
  rangeEnd,
  monthsByKey,
  coveredMonths,
  accountClosed,
  balanceGapsByKey,
  hasAnnualStatement,
  uploadingKey,
  onSelectFile,
}: YearMonthCellProps) {
  const label = MONTH_LABELS[month - 1];
  const inMonthRange = isMonthInRange(year, month, rangeStart, rangeEnd);
  const expectsStatement = isMonthExpectingStatement(
    monthKey,
    inMonthRange,
    balanceGapsByKey?.has(monthKey) ?? false,
    coveredMonths,
    accountClosed
  );
  const availability = monthsByKey.get(monthKey);
  const hasFiles = availability !== undefined && availability.formats.length > 0;
  const statementDate = availability?.statement_date ?? statementDateForCoveredMonth(monthKey);
  const balanceGapStatus = balanceGapsByKey?.get(monthKey);
  const chips = buildMonthChips(
    expectsStatement,
    availability,
    monthKey,
    statementDate,
    uploadingKey,
    onSelectFile
  );

  return (
    <MonthTile
      label={label}
      cellClassName={monthCellClassName(
        expectsStatement,
        hasFiles,
        balanceGapStatus,
        hasAnnualStatement
      )}
      chips={chips}
    />
  );
}

export function YearCalendarGrid({
  section,
  rangeStart,
  rangeEnd,
  monthsByKey,
  coveredMonths,
  accountClosed,
  balanceGapsByKey,
  annualStatement,
  uploadingKey = null,
  onSelectFile,
  onSelectAnnualFile,
}: YearCalendarGridProps) {
  const annualStatementDate = annualStatement?.statement_date ?? section.year_key;
  const hasAnnualStatement = (annualStatement?.formats.length ?? 0) > 0;

  return (
    <section className="rounded-sm border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">{section.label}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Annual</span>
          {ANNUAL_FORMATS.map((format) => {
            const available = annualFormatIsAvailable(annualStatement, format);
            const uploadable = (UPLOADABLE_FORMATS as readonly StatementFormat[]).includes(format);
            if (!available && !uploadable) {
              return null;
            }
            const formatLabel = format.toUpperCase();
            const action = available ? "View" : "Upload";
            const uploading = uploadingKey === annualStatementUploadKey(section.year_key, format);
            const title = uploading
              ? `Uploading annual ${formatLabel} for ${section.label}…`
              : `${action} annual ${formatLabel} for ${section.label}`;

            return (
              <Chip
                key={format}
                label={format}
                title={title}
                available={available}
                uploading={uploading}
                onClick={() =>
                  onSelectAnnualFile({
                    yearKey: section.year_key,
                    statementDate: annualStatementDate,
                    format,
                    available,
                  })
                }
              />
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {section.months.map(({ month, year, month_key: monthKey }) => (
          <YearMonthCell
            key={monthKey}
            month={month}
            year={year}
            monthKey={monthKey}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            monthsByKey={monthsByKey}
            coveredMonths={coveredMonths}
            accountClosed={accountClosed}
            balanceGapsByKey={balanceGapsByKey}
            hasAnnualStatement={hasAnnualStatement}
            uploadingKey={uploadingKey}
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
    </section>
  );
}
