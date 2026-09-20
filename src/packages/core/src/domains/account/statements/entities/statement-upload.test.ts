import { describe, expect, test } from "bun:test";
import { StatementUpload } from "@core/domains/account/statements/entities/statement-upload";
import { ValidationError } from "@core/shared/errors/domain-error";

describe("StatementUpload", () => {
  test("accepts monthly pdf upload", () => {
    const upload = StatementUpload.create({
      format: "pdf",
      filename: "statement.pdf",
      statementKind: "monthly",
      coveredMonth: "2024-06",
    });

    expect(upload.format).toBe("pdf");
    expect(upload.filename).toBe("statement.pdf");
    expect(upload.statementKind).toBe("monthly");
    expect(upload.statementDate).toBe("2024-06");
  });

  test("accepts annual csv upload", () => {
    const upload = StatementUpload.create({
      format: "csv",
      filename: "annual.csv",
      statementKind: "annual",
      yearKey: "2024",
    });

    expect(upload.statementKind).toBe("annual");
    expect(upload.statementDate).toBe("2024");
  });

  test("zip upload has null statement date", () => {
    const upload = StatementUpload.create({
      format: "zip",
      filename: "archive.zip",
    });

    expect(upload.format).toBe("zip");
    expect(upload.statementDate).toBeNull();
  });

  test("defaults statement kind to monthly", () => {
    const upload = StatementUpload.create({
      format: "pdf",
      filename: "statement.pdf",
      coveredMonth: "2024-01",
    });

    expect(upload.statementKind).toBe("monthly");
  });

  test("rejects invalid format", () => {
    expect(() =>
      StatementUpload.create({
        format: "txt",
        filename: "statement.txt",
        coveredMonth: "2024-01",
      })
    ).toThrow(ValidationError);
  });

  test("rejects missing filename", () => {
    expect(() =>
      StatementUpload.create({
        format: "pdf",
        filename: null,
        coveredMonth: "2024-01",
      })
    ).toThrow(ValidationError);
  });

  test("rejects wrong extension", () => {
    expect(() =>
      StatementUpload.create({
        format: "pdf",
        filename: "statement.csv",
        coveredMonth: "2024-01",
      })
    ).toThrow(ValidationError);
  });

  test("rejects invalid statement kind", () => {
    expect(() =>
      StatementUpload.create({
        format: "pdf",
        filename: "statement.pdf",
        statementKind: "weekly",
        coveredMonth: "2024-01",
      })
    ).toThrow(ValidationError);
  });

  test("rejects annual upload without year key", () => {
    expect(() =>
      StatementUpload.create({
        format: "pdf",
        filename: "statement.pdf",
        statementKind: "annual",
      })
    ).toThrow(ValidationError);
  });

  test("rejects annual upload with covered month", () => {
    expect(() =>
      StatementUpload.create({
        format: "pdf",
        filename: "statement.pdf",
        statementKind: "annual",
        yearKey: "2024",
        coveredMonth: "2024-01",
      })
    ).toThrow(ValidationError);
  });

  test("rejects monthly upload without covered month", () => {
    expect(() =>
      StatementUpload.create({
        format: "pdf",
        filename: "statement.pdf",
        statementKind: "monthly",
      })
    ).toThrow(ValidationError);
  });

  test("rejects monthly upload with year key", () => {
    expect(() =>
      StatementUpload.create({
        format: "pdf",
        filename: "statement.pdf",
        statementKind: "monthly",
        coveredMonth: "2024-01",
        yearKey: "2024",
      })
    ).toThrow(ValidationError);
  });

  test("rejects invalid covered month format", () => {
    expect(() =>
      StatementUpload.create({
        format: "pdf",
        filename: "statement.pdf",
        coveredMonth: "2024-13-01",
      })
    ).toThrow(ValidationError);
  });
});
