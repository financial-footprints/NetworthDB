import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertQpdfAvailable } from "@statements/ingest/pdf/helpers";
import {
  classifyPdfOpenDetail,
  decryptPdfToBytes,
  extractPdfText,
  extractPdfTextFromBytes,
  PdfError,
  pdfBytesLookEncrypted,
  pdfOpenFailureFromError,
} from "@statements/ingest/pdf/index";
import { PDFDocument, StandardFonts } from "pdf-lib";

async function buildSamplePdfBytes(text: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  const font = await doc.embedFont(StandardFonts.Courier);
  page.drawText(text, { x: 100, y: 600, size: 12, font });
  return Buffer.from(await doc.save());
}

describe("pdf extract", () => {
  let tempDir = "";

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  test("extract unencrypted pdf text", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "ndb-pdf-test-"));
    const path = join(tempDir, "plain.pdf");
    writeFileSync(path, await buildSamplePdfBytes("SAMPLE TEXT"));
    const text = await extractPdfText(path, []);
    expect(text).toContain("SAMPLE TEXT");
  });

  test("extract from bytes", async () => {
    const text = await extractPdfTextFromBytes(await buildSamplePdfBytes("OneCard Statement"), []);
    expect(text).toContain("OneCard Statement");
  });

  test("extract groups text items into lines by vertical position", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const font = await doc.embedFont(StandardFonts.Courier);
    page.drawText("LINE_ONE", { x: 72, y: 700, size: 12, font });
    page.drawText("LINE_TWO", { x: 72, y: 500, size: 12, font });
    const text = await extractPdfTextFromBytes(Buffer.from(await doc.save()), []);
    expect(text).toContain("LINE_ONE");
    expect(text).toContain("LINE_TWO");
    expect(text.indexOf("LINE_ONE")).toBeLessThan(text.indexOf("LINE_TWO"));
    expect(text).toMatch(/LINE_ONE\nLINE_TWO/);
  });

  test("extract missing file fails", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "ndb-pdf-test-"));
    const path = join(tempDir, "missing.pdf");
    await expect(extractPdfText(path, [])).rejects.toBeInstanceOf(PdfError);
  });

  test("classify incorrect password error", () => {
    expect(classifyPdfOpenDetail("the supplied password is incorrect")).toBe("incorrect-password");
  });

  test("classify unsupported encryption errors", () => {
    expect(classifyPdfOpenDetail("unsupported key length")).toBe("unsupported-encryption");
    expect(classifyPdfOpenDetail("invalid key length")).toBe("unsupported-encryption");
    expect(
      classifyPdfOpenDetail(
        "the document uses an encryption scheme that is not implemented in lopdf"
      )
    ).toBe("unsupported-encryption");
  });

  test("pdfOpenFailureFromError uses trailing detail", () => {
    const failure = pdfOpenFailureFromError(
      new PdfError("could not open /tmp/bad.pdf: the supplied password is incorrect")
    );
    expect(failure.kind).toBe("incorrect-password");
  });

  test("decrypt password protected pdf to unencrypted bytes", async () => {
    assertQpdfAvailable();
    tempDir = mkdtempSync(join(tmpdir(), "ndb-pdf-test-"));

    const password = "bob-test";
    const plainPath = join(tempDir, "plain.pdf");
    const encryptedPath = join(tempDir, "encrypted.pdf");
    writeFileSync(plainPath, await buildSamplePdfBytes("BOB protected"));
    execFileSync(
      "qpdf",
      ["--encrypt", password, password, "128", "--use-aes=y", "--", plainPath, encryptedPath],
      { stdio: "pipe" }
    );
    const encrypted = readFileSync(encryptedPath);
    expect(pdfBytesLookEncrypted(encrypted)).toBe(true);
    const decrypted = await decryptPdfToBytes(encrypted, [password]);
    expect(pdfBytesLookEncrypted(decrypted)).toBe(false);
    const text = await extractPdfTextFromBytes(decrypted, []);
    expect(text).toContain("BOB protected");
  });
});
