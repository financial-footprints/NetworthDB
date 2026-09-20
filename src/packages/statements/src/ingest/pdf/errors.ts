export type PdfOpenFailureKind = "incorrect-password" | "unsupported-encryption" | "other";

export type PdfOpenFailure = {
  kind: PdfOpenFailureKind;
  message: string;
};

export class PdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfError";
  }
}

export function classifyPdfOpenDetail(detail: string): PdfOpenFailureKind {
  const lower = detail.toLowerCase();
  if (
    lower.includes("the supplied password is incorrect") ||
    lower.includes("invalid padding encountered when decrypting")
  ) {
    return "incorrect-password";
  }
  if (
    lower.includes("unsupported key length") ||
    lower.includes("invalid key length") ||
    lower.includes("unsupported revision") ||
    lower.includes("encryption revision is not implemented") ||
    lower.includes("encryption scheme that is not") ||
    lower.includes("encryption version is not implemented")
  ) {
    return "unsupported-encryption";
  }
  return "other";
}

export function pdfOpenFailureFromError(error: PdfError): PdfOpenFailure {
  const message = error.message;
  const detail = message.includes(": ") ? message.slice(message.lastIndexOf(": ") + 2) : message;
  return {
    kind: classifyPdfOpenDetail(detail),
    message,
  };
}
