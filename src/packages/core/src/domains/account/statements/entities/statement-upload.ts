import { ValidationError } from "@core/shared/errors/domain-error";

const MONTH_PERIOD_PATTERN = /^\d{4}-\d{2}$/;

export type UploadSourceFormat = "pdf" | "csv" | "zip";
export type StatementKind = "monthly" | "annual";

const UPLOAD_FORMAT_EXTENSIONS: Record<UploadSourceFormat, string> = {
  pdf: ".pdf",
  csv: ".csv",
  zip: ".zip",
};

export class StatementUpload {
  private constructor(
    public readonly format: UploadSourceFormat,
    public readonly filename: string,
    public readonly statementKind: StatementKind,
    public readonly statementDate: string | null
  ) {}

  static create(input: {
    format: string;
    filename: string | null;
    statementKind?: string;
    coveredMonth?: string | null;
    yearKey?: string | null;
  }): StatementUpload {
    const format = StatementUpload.parseUploadFormat(input.format);
    StatementUpload.assertFilenameExtension(input.filename, format);
    const statementKind = StatementUpload.parseStatementKind(input.statementKind ?? "monthly");
    const statementDate =
      format === "zip"
        ? null
        : StatementUpload.resolveStatementDate({
            statementKind,
            coveredMonth: input.coveredMonth,
            yearKey: input.yearKey,
          });

    return new StatementUpload(format, input.filename ?? "upload", statementKind, statementDate);
  }

  private static parseUploadFormat(fmt: string): UploadSourceFormat {
    const normalized = fmt.toLowerCase();
    if (normalized === "pdf" || normalized === "csv" || normalized === "zip") {
      return normalized;
    }

    throw new ValidationError("Upload format is invalid.", {
      field: "format",
      value: fmt,
    });
  }

  private static parseStatementKind(kind: string): StatementKind {
    const normalized = kind.toLowerCase();
    if (normalized === "monthly" || normalized === "annual") {
      return normalized;
    }

    throw new ValidationError("Statement kind is invalid.", {
      field: "statementKind",
      value: kind,
    });
  }

  private static assertFilenameExtension(
    filename: string | null | undefined,
    format: UploadSourceFormat
  ): void {
    if (!filename) {
      throw new ValidationError("Filename is required.");
    }

    const expected = UPLOAD_FORMAT_EXTENSIONS[format];
    if (!filename.toLowerCase().endsWith(expected)) {
      throw new ValidationError("File extension is invalid.", {
        field: "filename",
        context: { expected, format },
      });
    }
  }

  private static resolveStatementDate(input: {
    statementKind: StatementKind;
    coveredMonth?: string | null;
    yearKey?: string | null;
  }): string {
    if (input.statementKind === "annual") {
      if (!input.yearKey?.trim()) {
        throw new ValidationError("Year key is required.");
      }
      if (input.coveredMonth) {
        throw new ValidationError("Covered month is invalid for annual statements.");
      }
      return input.yearKey.trim();
    }

    if (!input.coveredMonth?.trim()) {
      throw new ValidationError("Covered month is required.");
    }
    if (input.yearKey) {
      throw new ValidationError("Year key is invalid for monthly statements.");
    }

    const coveredMonth = input.coveredMonth.trim();
    if (!MONTH_PERIOD_PATTERN.test(coveredMonth)) {
      throw new ValidationError("Covered month format is invalid.", {
        field: "coveredMonth",
        value: coveredMonth,
      });
    }

    return coveredMonth;
  }
}
