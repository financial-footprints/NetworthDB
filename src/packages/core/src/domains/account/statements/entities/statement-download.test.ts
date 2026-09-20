import { describe, expect, test } from "bun:test";
import { StatementDownload } from "@core/domains/account/statements/entities/statement-download";
import { ValidationError } from "@core/shared/errors/domain-error";

describe("StatementDownload", () => {
  test("accepts supported formats", () => {
    expect(StatementDownload.create({ format: "pdf", statementDate: "2024-06" }).format).toBe(
      "pdf"
    );
    expect(StatementDownload.create({ format: "csv", statementDate: "2024-06" }).format).toBe(
      "csv"
    );
    expect(StatementDownload.create({ format: "zip", statementDate: "2024-06" }).format).toBe(
      "zip"
    );
    expect(StatementDownload.create({ format: "txt", statementDate: "2024-06" }).format).toBe(
      "txt"
    );
  });

  test("preserves statement date", () => {
    const download = StatementDownload.create({
      format: "pdf",
      statementDate: "2024-06",
    });

    expect(download.statementDate).toBe("2024-06");
  });

  test("normalizes format case", () => {
    const download = StatementDownload.create({
      format: "PDF",
      statementDate: "2024-06",
    });

    expect(download.format).toBe("pdf");
  });

  test("rejects invalid format", () => {
    expect(() => StatementDownload.create({ format: "doc", statementDate: "2024-06" })).toThrow(
      ValidationError
    );
  });
});
