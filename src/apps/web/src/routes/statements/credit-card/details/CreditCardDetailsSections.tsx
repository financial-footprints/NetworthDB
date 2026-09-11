import { ConfirmDeleteButton, IconActionButton } from "@web/components/button";
import { DetailsField } from "@web/components/fields/DetailsField";
import { CreditCardTile } from "@web/routes/statements/credit-card/CreditCardTile";
import { CREDIT_CARD_WIDTH } from "@web/routes/statements/credit-card/constants";
import { CalendarColorLegend } from "@web/routes/statements/shared/CalendarColorLegend";
import { StatementCoverage } from "@web/routes/statements/shared/StatementCoverage";
import {
  type AnnualFileSelection,
  type FileSelection,
  YearCalendarGrid,
} from "@web/routes/statements/shared/YearCalendarGrid";
import { deleteAccount } from "@web/utils/api/endpoints/accounts";
import type {
  Account,
  AccountDetails,
  AnnualStatementAvailability,
  BalanceGapStatus,
  MonthAvailability,
} from "@web/utils/api/endpoints/accounts/types";
import { ACCOUNT_TYPE_LABELS } from "@web/utils/api/endpoints/accounts/types";
import { formatAccountDateLabel, type MonthYear } from "@web/utils/time";
import { LuPencil } from "react-icons/lu";

type CreditCardDetailsHeaderProps = {
  account: Account;
  details: AccountDetails;
  onEdit?: () => void;
  onAccountDeleted?: () => void;
  onOpenMetadata: () => void;
};

export function CreditCardDetailsHeader({
  account,
  details,
  onEdit,
  onAccountDeleted,
  onOpenMetadata,
}: CreditCardDetailsHeaderProps) {
  const metadataUrl = details.statements.available ? "available" : undefined;

  return (
    <section className="rounded-sm border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="flex shrink-0 flex-col gap-4" style={{ width: CREDIT_CARD_WIDTH }}>
          <CreditCardTile account={account} />
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <dl className="grid flex-1 gap-4 sm:grid-cols-2">
              <DetailsField label="Account Number" value={account.account_number} />
              <DetailsField
                label="Account Type"
                value={ACCOUNT_TYPE_LABELS[account.account_type]}
              />
              <DetailsField
                label="Opening Date"
                value={account.opening_date ? formatAccountDateLabel(account.opening_date) : "—"}
              />
              <DetailsField
                label="Closing Date"
                value={account.closing_date ? formatAccountDateLabel(account.closing_date) : "—"}
              />
            </dl>

            {onEdit || onAccountDeleted ? (
              <div className="flex shrink-0 items-center gap-1">
                {onEdit ? (
                  <IconActionButton title="Edit account" tone="edit" onClick={onEdit}>
                    <LuPencil className="size-4" strokeWidth={2} aria-hidden />
                  </IconActionButton>
                ) : null}
                {onAccountDeleted ? (
                  <ConfirmDeleteButton
                    variant="icon"
                    confirmMessage={`Delete account ${account.account_number}? This cannot be undone.`}
                    onDelete={() => deleteAccount(account.id, "credit_card")}
                    onSuccess={onAccountDeleted}
                    errorMessage="Could not delete account"
                    title="Delete account"
                    loadingLabel="Deleting account…"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <StatementCoverage
          periodCovered={details.statements.coverage}
          statementCount={details.statements.statement_count}
          calendarStart={details.calendar_start ?? null}
          calendarEnd={details.calendar_end ?? null}
          calendarEndSource={details.calendar_end_source}
          metadataUrl={metadataUrl}
          onOpenMetadata={onOpenMetadata}
        />
      </div>
    </section>
  );
}

type CreditCardCalendarSectionProps = {
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

export function CreditCardCalendarSection({
  details,
  calendarStart,
  calendarEnd,
  monthsByKey,
  annualStatementsByKey,
  balanceGapsByKey,
  uploadingKey,
  onSelectFile,
  onSelectAnnualFile,
}: CreditCardCalendarSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CalendarColorLegend />
      </div>
      {details.calendar_year_sections.map((section) => (
        <YearCalendarGrid
          key={section.year_key}
          section={section}
          rangeStart={calendarStart}
          rangeEnd={calendarEnd}
          monthsByKey={monthsByKey}
          coveredMonths={details.statements.coverage.months ?? []}
          accountClosed={details.closing_date_configured}
          balanceGapsByKey={balanceGapsByKey}
          annualStatement={annualStatementsByKey.get(section.year_key)}
          uploadingKey={uploadingKey}
          onSelectFile={onSelectFile}
          onSelectAnnualFile={onSelectAnnualFile}
        />
      ))}
    </div>
  );
}
