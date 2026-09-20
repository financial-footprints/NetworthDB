import type { UploadSourceFormat } from "@core/domains/account/statements/entities/statement-upload";
import { ValidationError } from "@core/shared/errors/domain-error";

export type DownloadSourceFormat = UploadSourceFormat | "txt" | "transactions";

export class StatementDownload {
  private constructor(
    public readonly format: DownloadSourceFormat,
    public readonly statementDate: string
  ) {}

  static create(input: { format: string; statementDate: string }): StatementDownload {
    const format = StatementDownload.parseDownloadFormat(input.format);

    return new StatementDownload(format, input.statementDate);
  }

  private static parseDownloadFormat(fmt: string): DownloadSourceFormat {
    const normalized = fmt.toLowerCase();
    if (
      normalized === "pdf" ||
      normalized === "csv" ||
      normalized === "zip" ||
      normalized === "txt" ||
      normalized === "transactions"
    ) {
      return normalized;
    }

    throw new ValidationError("Download format is invalid.", {
      field: "format",
      value: fmt,
    });
  }
}
