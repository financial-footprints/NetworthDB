import { fetchAccountFileBlob } from "@web/utils/api/endpoints/accounts";
import type { StatementFormat } from "@web/utils/api/endpoints/accounts/types";
import type { RefObject } from "react";

export const UPLOAD_ACCEPT: Record<"pdf" | "csv", string> = {
  pdf: ".pdf,application/pdf",
  csv: ".csv,text/csv",
};

export type PendingUpload =
  | { kind: "monthly"; month: string; format: "pdf" | "csv" }
  | { kind: "annual"; yearKey: string; format: "pdf" | "csv" };

type OpenTextFileViewer = (params: {
  title: string;
  url: string;
  downloadFilename: string;
  format: "text";
}) => void;

export async function openAccountStatementFile(params: {
  accountId: string;
  statementDate: string;
  format: StatementFormat;
  titleLabel: string;
  openTextFile: OpenTextFileViewer;
}): Promise<void> {
  const { accountId, statementDate, format, titleLabel, openTextFile } = params;
  const blob = await fetchAccountFileBlob({
    accountId,
    statementDate,
    format,
  });
  const fileUrl = URL.createObjectURL(blob);

  if (format === "pdf") {
    window.open(fileUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const formatLabel = format.toUpperCase();
  openTextFile({
    title: `${titleLabel} · ${formatLabel}`,
    url: fileUrl,
    downloadFilename: `${statementDate}.${format}`,
    format: "text",
  });
}

export function prepareUploadFileInput(
  fileInputRef: RefObject<HTMLInputElement | null>,
  format: "pdf" | "csv"
): void {
  if (!fileInputRef.current) {
    return;
  }
  fileInputRef.current.accept = UPLOAD_ACCEPT[format];
  fileInputRef.current.value = "";
  fileInputRef.current.click();
}
