import { describe, expect, test } from "bun:test";
import {
  extractCsvsFromZip,
  extractStatementsFromZip,
  sanitizeZipMemberName,
  ZipArchiveError,
  ZipNoCsvError,
  ZipNoStatementFilesError,
  ZipPasswordError,
} from "@statements/ingest/zip/index";
import { buildAesZip, buildZip, minimalPdfBytes } from "@tests/statements/helpers/zip-fixtures";

describe("zip archive extract", () => {
  test("extract single csv", async () => {
    const data = await buildZip([
      { name: "statement.csv", content: "Date,Amount\n2024-01-01,1.00\n" },
    ]);
    const extracted = await extractCsvsFromZip(data, []);
    expect(extracted).toHaveLength(1);
    expect(extracted[0]?.innerName).toBe("statement.csv");
    expect(extracted[0]?.content.toString()).toContain("Date,Amoun");
  });

  test("extract multiple csvs", async () => {
    const data = await buildZip([
      { name: "folder/a.csv", content: "a" },
      { name: "folder/b.CSV", content: "b" },
    ]);
    const extracted = await extractCsvsFromZip(data, []);
    expect(extracted).toHaveLength(2);
    expect(new Set(extracted.map((item) => item.innerName))).toEqual(new Set(["a.csv", "b.CSV"]));
  });

  test("skips macosx and non csv", async () => {
    const data = await buildZip([
      { name: "__MACOSX/._statement.csv", content: "meta" },
      { name: "readme.txt", content: "ignore" },
      { name: "statement.csv", content: "data" },
    ]);
    const extracted = await extractCsvsFromZip(data, []);
    expect(extracted).toHaveLength(1);
    expect(extracted[0]?.innerName).toBe("statement.csv");
  });

  test("rejects zip slip member", async () => {
    const data = await buildZip([{ name: "../escape.csv", content: "bad" }]);
    await expect(extractCsvsFromZip(data, [])).rejects.toBeInstanceOf(ZipArchiveError);
  });

  test("no csv members raises", async () => {
    const data = await buildZip([{ name: "readme.txt", content: "no csv here" }]);
    await expect(extractCsvsFromZip(data, [])).rejects.toBeInstanceOf(ZipNoCsvError);
  });

  test("invalid zip raises", async () => {
    await expect(extractCsvsFromZip(Buffer.from("not-a-zip"), [])).rejects.toThrow(
      "invalid zip archive"
    );
  });

  test("extract aes encrypted csv", async () => {
    const data = await buildAesZip(
      [{ name: "statement.csv", content: "Date,Amount\n2024-01-01,1.00\n" }],
      "secret"
    );
    const extracted = await extractCsvsFromZip(data, ["secret"]);
    expect(extracted).toHaveLength(1);
    expect(extracted[0]?.innerName).toBe("statement.csv");
  });

  test("aes password failure raises", async () => {
    const data = await buildAesZip([{ name: "statement.csv", content: "data" }], "secret");
    await expect(extractCsvsFromZip(data, ["wrong"])).rejects.toBeInstanceOf(ZipPasswordError);
  });

  test("sanitize zip member name cases", () => {
    expect(sanitizeZipMemberName("nested/path/file.csv")).toBe("file.csv");
    expect(sanitizeZipMemberName("../bad.csv")).toBe("bad.csv");
    expect(sanitizeZipMemberName("")).toBe("attachment");
    expect(sanitizeZipMemberName(".")).toBe("attachment");
    expect(sanitizeZipMemberName("..")).toBe("attachment");
  });

  test("extract mixed csv and pdf", async () => {
    const data = await buildZip([
      { name: "statement.csv", content: "Date,Amount\n" },
      { name: "statement.pdf", content: minimalPdfBytes() },
    ]);
    const extracted = await extractStatementsFromZip(data, []);
    expect(extracted).toHaveLength(2);
    expect(new Set(extracted.map((item) => item.innerName))).toEqual(
      new Set(["statement.csv", "statement.pdf"])
    );
  });

  test("no statement files raises", async () => {
    const data = await buildZip([{ name: "readme.txt", content: "no statement files here" }]);
    await expect(extractStatementsFromZip(data, [])).rejects.toBeInstanceOf(
      ZipNoStatementFilesError
    );
  });
});
