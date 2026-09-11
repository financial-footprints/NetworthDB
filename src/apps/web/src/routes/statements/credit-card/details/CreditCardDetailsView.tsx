import { useFileViewer } from "@web/context/FileViewer/FileViewerContext";
import { useNotifications } from "@web/context/Notifications/NotificationContext";
import {
  CreditCardCalendarSection,
  CreditCardDetailsHeader,
} from "@web/routes/statements/credit-card/details/CreditCardDetailsSections";
import { submitStatementUpload } from "@web/routes/statements/helpers";
import {
  openAccountStatementFile,
  type PendingUpload,
  prepareUploadFileInput,
} from "@web/routes/statements/shared/helpers/statementFileActions";
import {
  type AnnualFileSelection,
  annualStatementUploadKey,
  type FileSelection,
  statementUploadKey,
} from "@web/routes/statements/shared/YearCalendarGrid";
import type { AccountDetails } from "@web/utils/api/endpoints/accounts/types";
import {
  annualAvailabilityFromStatements,
  monthlyAvailabilityFromStatements,
} from "@web/utils/api/endpoints/accounts/types";
import { errorMessage } from "@web/utils/errors";
import {
  accountDateToMonthYear,
  currentMonthYear,
  formatYearMonthLabel,
  type MonthYear,
} from "@web/utils/time";
import { useMemo, useRef, useState } from "react";

type CreditCardDetailsViewProps = {
  details: AccountDetails;
  onUploadSuccess?: () => void;
  onEdit?: () => void;
  onAccountDeleted?: () => void;
};

export function CreditCardDetailsView({
  details,
  onUploadSuccess,
  onEdit,
  onAccountDeleted,
}: CreditCardDetailsViewProps) {
  const { account } = details;
  const { openFileViewer } = useFileViewer();
  const { pushNotification } = useNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const calendarStart = details.calendar_start
    ? accountDateToMonthYear(details.calendar_start)
    : null;
  const calendarEnd: MonthYear =
    (details.calendar_end ? accountDateToMonthYear(details.calendar_end) : null) ??
    currentMonthYear();
  const monthsByKey = useMemo(
    () => monthlyAvailabilityFromStatements(details.statements),
    [details.statements]
  );
  const annualStatementsByKey = useMemo(
    () => annualAvailabilityFromStatements(details.statements),
    [details.statements]
  );
  const balanceGapsByKey = useMemo(
    () => new Map((details.statements.balance_gaps ?? []).map((gap) => [gap.month, gap.status])),
    [details.statements.balance_gaps]
  );

  function openTextStatementFile(params: { title: string; url: string; downloadFilename: string }) {
    openFileViewer({ ...params, format: "text" });
  }

  function openStatementFile(selection: FileSelection) {
    void openAccountStatementFile({
      accountId: account.id,
      statementDate: selection.statementDate,
      format: selection.format,
      titleLabel: formatYearMonthLabel(selection.month),
      openTextFile: openTextStatementFile,
    }).catch((error: unknown) => {
      pushNotification(errorMessage(error, "Failed to open statement file."), "error");
    });
  }

  function openAnnualStatementFile(selection: AnnualFileSelection) {
    void openAccountStatementFile({
      accountId: account.id,
      statementDate: selection.statementDate,
      format: selection.format,
      titleLabel: `${selection.yearKey} · Annual`,
      openTextFile: openTextStatementFile,
    }).catch((error: unknown) => {
      pushNotification(errorMessage(error, "Failed to open statement file."), "error");
    });
  }

  function handleSelectFile(selection: FileSelection) {
    if (selection.available) {
      openStatementFile(selection);
      return;
    }

    if (selection.format !== "pdf" && selection.format !== "csv") {
      return;
    }

    setPendingUpload({
      kind: "monthly",
      month: selection.month,
      format: selection.format,
    });
    prepareUploadFileInput(fileInputRef, selection.format);
  }

  function handleSelectAnnualFile(selection: AnnualFileSelection) {
    if (selection.available) {
      openAnnualStatementFile(selection);
      return;
    }

    if (selection.format !== "pdf" && selection.format !== "csv") {
      return;
    }

    setPendingUpload({
      kind: "annual",
      yearKey: selection.yearKey,
      format: selection.format,
    });
    prepareUploadFileInput(fileInputRef, selection.format);
  }

  async function handleFileSelected(fileList: FileList | null) {
    if (!fileList?.length) {
      setPendingUpload(null);
      return;
    }

    const file = fileList[0];
    const upload = pendingUpload;
    setPendingUpload(null);

    if (!upload) {
      return;
    }

    if (upload.kind === "annual") {
      const { yearKey, format } = upload;
      await submitStatementUpload({
        accountId: account.id,
        request: {
          yearKey,
          statementKind: "annual",
          format,
          file,
        },
        onUploadSuccess,
        pushNotification,
        onBusyChange: (busy) => {
          setUploadingKey(busy ? annualStatementUploadKey(yearKey, format) : null);
        },
      });
      return;
    }

    const { month, format } = upload;
    await submitStatementUpload({
      accountId: account.id,
      request: {
        coveredMonth: month,
        statementKind: "monthly",
        format,
        file,
      },
      onUploadSuccess,
      pushNotification,
      onBusyChange: (busy) => {
        setUploadingKey(busy ? statementUploadKey(month, format) : null);
      },
    });
  }

  function handleOpenMetadata() {
    if (!details.statements.available) {
      return;
    }
    const blob = new Blob([JSON.stringify(details.statements, null, 2)], {
      type: "application/json",
    });
    openFileViewer({
      title: "Statements",
      url: URL.createObjectURL(blob),
      format: "json",
    });
  }

  return (
    <div className="space-y-8">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          void handleFileSelected(event.target.files);
        }}
      />

      <div>
        <CreditCardDetailsHeader
          account={account}
          details={details}
          onEdit={onEdit}
          onAccountDeleted={onAccountDeleted}
          onOpenMetadata={handleOpenMetadata}
        />

        {onEdit ? (
          <p className="mt-2 text-right text-xs text-slate-500">
            *Settings such as statement and email rules are visible when you're editing the account
          </p>
        ) : null}
      </div>

      {calendarStart ? (
        <CreditCardCalendarSection
          details={details}
          calendarStart={calendarStart}
          calendarEnd={calendarEnd}
          monthsByKey={monthsByKey}
          annualStatementsByKey={annualStatementsByKey}
          balanceGapsByKey={balanceGapsByKey}
          uploadingKey={uploadingKey}
          onSelectFile={handleSelectFile}
          onSelectAnnualFile={handleSelectAnnualFile}
        />
      ) : null}
    </div>
  );
}
