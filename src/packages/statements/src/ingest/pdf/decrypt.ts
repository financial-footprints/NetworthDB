import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PdfError } from "@statements/ingest/pdf/errors";
import { pdfBytesLookEncrypted } from "@statements/ingest/pdf/helpers";
import { passwordCandidates } from "@statements/ingest/zip/index";

function runQpdfDecrypt(inputPath: string, outputPath: string, password: string | undefined): void {
  const args = ["--decrypt"];
  if (password !== undefined && password.length > 0) {
    args.push(`--password=${password}`);
  }
  args.push(inputPath, outputPath);

  try {
    execFileSync("qpdf", args, { stdio: "pipe" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PdfError(`qpdf decrypt failed: ${message}`);
  }
}

export async function decryptPdfToBytes(data: Buffer, passwords: string[]): Promise<Buffer> {
  if (!pdfBytesLookEncrypted(data)) {
    return data;
  }

  const workDir = mkdtempSync(join(tmpdir(), "ndb-qpdf-"));
  const inputPath = join(workDir, "in.pdf");
  const outputPath = join(workDir, "out.pdf");
  try {
    writeFileSync(inputPath, data);

    const candidates = passwordCandidates(passwords);
    let lastError: string | undefined;
    for (const password of candidates) {
      try {
        runQpdfDecrypt(inputPath, outputPath, password.length > 0 ? password : undefined);
        const decrypted = readFileSync(outputPath);
        if (pdfBytesLookEncrypted(decrypted)) {
          throw new PdfError("qpdf output is still encrypted");
        }
        return decrypted;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    throw new PdfError(`could not decrypt pdf: ${lastError ?? "qpdf failed"}`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

/** Rewrite PDF structure so pdf.js can read text on all pages (BOB multi-page statements). */
export function qpdfLinearizeBytes(data: Buffer): Buffer {
  const workDir = mkdtempSync(join(tmpdir(), "ndb-qpdf-linearize-"));
  const inputPath = join(workDir, "in.pdf");
  const outputPath = join(workDir, "out.pdf");
  try {
    writeFileSync(inputPath, data);
    execFileSync("qpdf", ["--linearize", inputPath, outputPath], { stdio: "pipe" });
    return readFileSync(outputPath);
  } catch {
    return data;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

export async function decryptPdfFileInPlace(path: string, passwords: string[]): Promise<boolean> {
  const data = readFileSync(path);
  if (!pdfBytesLookEncrypted(data)) {
    return false;
  }
  const decrypted = await decryptPdfToBytes(data, passwords);
  writeFileSync(path, decrypted);
  return true;
}
