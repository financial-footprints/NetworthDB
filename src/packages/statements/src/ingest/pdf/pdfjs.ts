import { qpdfLinearizeBytes } from "@statements/ingest/pdf/decrypt";
import { PdfError } from "@statements/ingest/pdf/errors";
import { passwordCandidates } from "@statements/ingest/zip/index";

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
};

const LINE_Y_BUCKET = 2;

function textY(item: PdfTextItem): number {
  const t = item.transform;
  if (!t || t.length < 6) {
    return 0;
  }
  return t[5];
}

type PositionedText = { y: number; x: number; str: string; hasEOL: boolean };

function textX(item: PdfTextItem): number {
  const t = item.transform;
  if (!t || t.length < 5) {
    return 0;
  }
  return t[4] ?? 0;
}

function compareTextPieces(left: PositionedText, right: PositionedText): number {
  const dy = right.y - left.y;
  if (Math.abs(dy) > LINE_Y_BUCKET) {
    return dy;
  }
  return left.x - right.x;
}

function joinTextParts(parts: string[]): string {
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function appendTextPiece(
  lines: string[],
  parts: string[],
  piece: PositionedText,
  currentY: number
): number {
  let nextY = currentY;
  if (parts.length > 0 && Math.abs(piece.y - currentY) > LINE_Y_BUCKET) {
    lines.push(joinTextParts(parts));
    parts.length = 0;
    nextY = piece.y;
  } else if (parts.length === 0) {
    nextY = piece.y;
  }
  parts.push(piece.str);
  if (piece.hasEOL) {
    lines.push(joinTextParts(parts));
    parts.length = 0;
  }
  return nextY;
}

function joinTextLines(withText: PositionedText[]): string {
  const lines: string[] = [];
  const parts: string[] = [];
  let currentY = withText[0]?.y ?? 0;
  for (const piece of withText) {
    currentY = appendTextPiece(lines, parts, piece, currentY);
  }
  if (parts.length > 0) {
    lines.push(joinTextParts(parts));
  }
  return lines.filter((line) => line.length > 0).join("\n");
}

function pageTextFromItems(items: PdfTextItem[]): string {
  const withText: PositionedText[] = [];
  for (const item of items) {
    const str = item.str ?? "";
    if (str.length === 0) {
      continue;
    }
    withText.push({
      y: textY(item),
      x: textX(item),
      str,
      hasEOL: item.hasEOL === true,
    });
  }
  if (withText.length === 0) {
    return "";
  }
  withText.sort(compareTextPieces);
  return joinTextLines(withText);
}

type PdfDocument = {
  numPages: number;
  getPage(pageNumber: number): Promise<{
    getTextContent(): Promise<{ items: PdfTextItem[] }>;
  }>;
  destroy(): Promise<void>;
};

type PdfJsModule = {
  getDocument(input: {
    data: Uint8Array;
    password?: string;
    useSystemFonts?: boolean;
    isEvalSupported?: boolean;
  }): { promise: Promise<PdfDocument> };
};

async function loadPdfJs(): Promise<PdfJsModule> {
  return import("pdfjs-dist/legacy/build/pdf.mjs") as Promise<PdfJsModule>;
}

async function tryOpenDocument(data: Buffer, password?: string): Promise<PdfDocument> {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    password: password && password.length > 0 ? password : undefined,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  return task.promise;
}

export type PdfExtractStats = {
  text: string;
  numPages: number;
  pagesWithText: number;
};

export async function extractTextFromDocumentWithStats(pdf: PdfDocument): Promise<PdfExtractStats> {
  const pages: string[] = [];
  let pagesWithText = 0;
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = pageTextFromItems(content.items as PdfTextItem[]);
    if (text.length > 0) {
      pagesWithText += 1;
    }
    pages.push(text);
  }
  return {
    text: pages.join("\n\n"),
    numPages: pdf.numPages,
    pagesWithText,
  };
}

function shouldRetryExtractWithLinearize(stats: PdfExtractStats): boolean {
  return stats.numPages > 1 && stats.pagesWithText > 0 && stats.pagesWithText < stats.numPages;
}

export async function resolvePdfOpenPassword(
  data: Buffer,
  passwords: string[]
): Promise<string | undefined> {
  const candidates = passwordCandidates(passwords);
  let lastError: string | undefined;

  for (const password of candidates) {
    try {
      const doc = await tryOpenDocument(data, password || undefined);
      await doc.destroy();
      return password;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  const detail = lastError ? `: ${lastError}` : "";
  throw new PdfError(`could not open pdf${detail}`);
}

async function extractPdfTextWithDetail(
  detailPrefix: string,
  data: Buffer,
  passwords: string[]
): Promise<string> {
  const candidates = passwordCandidates(passwords);
  let lastError: string | undefined;

  for (const password of candidates) {
    try {
      return await extractPdfTextFromOpenedBytes(data, password || undefined);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  const detail = lastError ? `: ${lastError}` : "";
  throw new PdfError(`${detailPrefix}${detail}`);
}

async function extractPdfTextFromOpenedBytes(data: Buffer, password?: string): Promise<string> {
  let bytes = data;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const doc = await tryOpenDocument(bytes, password);
    try {
      const stats = await extractTextFromDocumentWithStats(doc);
      if (attempt === 0 && shouldRetryExtractWithLinearize(stats)) {
        const linear = qpdfLinearizeBytes(bytes);
        if (!linear.equals(bytes)) {
          bytes = linear;
          continue;
        }
      }
      return stats.text;
    } finally {
      await doc.destroy();
    }
  }
  throw new PdfError("could not extract pdf text");
}

export async function extractPdfTextFromBytes(data: Buffer, passwords: string[]): Promise<string> {
  return extractPdfTextWithDetail("could not open pdf", data, passwords);
}
