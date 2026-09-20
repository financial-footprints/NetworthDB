import {
  purgeDropSections,
  sanitizeStatementText,
  trimByMarkers,
} from "@statements/banks/helpers/text";

const TXN_WITH_REF =
  /\d{1,2}\/\d{1,2}\/\d{4}\s+\S+\s+.+\s+(?:\s+-?\d+)+\s+INR\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2}\s*(?:DR|CR)/i;

const TXN_DIRECT_INR =
  /\d{1,2}\/\d{1,2}\/\d{4}\s+\S+\s+INR\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2}\s*(?:DR|CR)/i;

const MULTI_PAGE = /Page\s+1\s+of\s+(\d+)/i;

const MULTI_PAGE_CONTINUATION = /\bPage\s+2\s+of\s+\d+/i;
const PAGE_FOOTER_LINE = /\bPage\s+\d+\s+of\s+\d+\b/i;

const BOB_SINGLE_PAGE_TRIM_END = ["Reward Summary at Card Level", "Page 1 of"];

export function normalizeBobPdfJsText(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n");

  text = text.replace(/(\))(\d{1,2}\/\d{1,2}\/\d{4})/g, "$1\n$2");
  text = text.replace(/(DR|CR)(\d{1,2}\/\d{1,2}\/\d{4})/gi, "$1\n$2");
  text = text.replace(/(Page \d+ of \d+)/gi, "\n$1");
  text = text.replace(/(Transaction Details)/gi, "\n$1");
  text = text.replace(/(Reward Summary at Card Level)/gi, "\n$1");

  return text;
}

export function countBobTxnLikeLines(text: string): number {
  let count = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (TXN_WITH_REF.test(trimmed) || TXN_DIRECT_INR.test(trimmed)) {
      count += 1;
    }
  }
  return count;
}

/** True when the PDF claims multiple pages but extracted text has no transaction rows. */
export function bobStatementTextMayBeIncomplete(text: string): boolean {
  const pageMatch = MULTI_PAGE.exec(text);
  if (!pageMatch) {
    return false;
  }
  const totalPages = Number.parseInt(pageMatch[1] ?? "1", 10);
  if (totalPages <= 1) {
    return false;
  }
  return countBobTxnLikeLines(text) === 0;
}

function stripBobMultiPageFooters(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      if (PAGE_FOOTER_LINE.test(line)) {
        return false;
      }
      if (line.includes("Reward Summary at Card Level")) {
        return false;
      }
      return true;
    })
    .join("\n");
}

function trimBobStatementText(normalized: string, trimStart: string[]): string {
  if (MULTI_PAGE_CONTINUATION.test(normalized)) {
    const fromStart = trimByMarkers(normalized, trimStart, []);
    return stripBobMultiPageFooters(fromStart);
  }
  return stripBobMultiPageFooters(trimByMarkers(normalized, trimStart, BOB_SINGLE_PAGE_TRIM_END));
}

export function cleanBobStatementText(raw: string, dropSections: string[]): string {
  const normalized = normalizeBobPdfJsText(raw);
  const trimmed = trimBobStatementText(normalized, []);
  const sanitized = sanitizeStatementText(trimmed);
  return purgeDropSections(sanitized, dropSections);
}
