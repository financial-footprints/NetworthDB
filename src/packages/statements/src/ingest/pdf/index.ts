import { readFileSync } from "node:fs";
import { decryptPdfFileInPlace, decryptPdfToBytes } from "@statements/ingest/pdf/decrypt";
import {
  classifyPdfOpenDetail,
  PdfError,
  type PdfOpenFailure,
  type PdfOpenFailureKind,
  pdfOpenFailureFromError,
} from "@statements/ingest/pdf/errors";
import { assertPlaintextPdfBytes, pdfBytesLookEncrypted } from "@statements/ingest/pdf/helpers";
import { extractPdfTextFromBytes } from "@statements/ingest/pdf/pdfjs";

export {
  assertPlaintextPdfBytes,
  classifyPdfOpenDetail,
  decryptPdfFileInPlace,
  decryptPdfToBytes,
  extractPdfTextFromBytes,
  PdfError,
  type PdfOpenFailure,
  type PdfOpenFailureKind,
  pdfBytesLookEncrypted,
  pdfOpenFailureFromError,
};

export async function extractPdfText(path: string, passwords: string[]): Promise<string> {
  let data: Buffer;
  try {
    data = readFileSync(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PdfError(`could not read ${path}: ${message}`);
  }
  return extractPdfTextFromBytes(data, passwords);
}
