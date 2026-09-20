import { execFileSync } from "node:child_process";

export function pdfBytesLookEncrypted(data: Buffer): boolean {
  return data.includes(Buffer.from("/Encrypt"));
}

export function assertPlaintextPdfBytes(data: Buffer, context: string): void {
  if (pdfBytesLookEncrypted(data)) {
    throw new Error(`statements.pipeline.pdf.encrypted-not-allowed: ${context}`);
  }
}

export function assertQpdfAvailable(): void {
  try {
    execFileSync("qpdf", ["--version"], { stdio: "pipe" });
  } catch {
    throw new Error("bootstrap.statements.required.not-found.qpdf");
  }
}
