import {
  amountsWithPositions,
  firstAmountInText,
  parseAmountString,
} from "@statements/banks/helpers/amounts";
import { findLabel, labelRegex } from "@statements/banks/helpers/dates";

const TABLE_SECTION_BOUNDARY = /Bonus\/Reward|Transaction Date|Transaction Details|Reward Summary/i;
const SUMMARY_TABLE_HEADER =
  /Opening|Balance|Total\s+Dues|Credits|Debits|Charges|Payment|Purchase|Finance|Previous\s+Balance|Closing\s+Balance/i;
const RS_AMOUNT = /Rs\.?\s*(-?\d[\d,]*(?:\.\d+)?|\.\d+)/i;
const DATE_IN_LINE = /\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\s+[A-Z]{3}\s+\d{4}/i;
const DATE_ONLY_LINE = /^\d{1,2}\/(?:\d{1,2}|[A-Za-z]{3})\/\d{2,4}$/i;
const OUTSTANDING_SECTION_END = /^(?:Rewards\b|Invoice\b|Payment\s*Due\s*Date\b)/i;
const TOTAL_ROW = /^Total\b/i;

function isTableSectionBoundary(line: string): boolean {
  return TABLE_SECTION_BOUNDARY.test(line);
}

function summaryTableHeaderSeen(headerLines: string[]): boolean {
  return headerLines.some((line) => SUMMARY_TABLE_HEADER.test(line));
}

function findExactLabelPosition(headerLines: string[], column: string): number | null {
  for (const line of headerLines) {
    const match = labelRegex(column).exec(line);
    if (match) {
      return match.index ?? 0;
    }
  }
  return null;
}

function findMultiWordLabelPosition(headerLines: string[], words: string[]): number | null {
  let lastPos: number | null = null;
  let firstPos: number | null = null;
  const lastWord = words[words.length - 1];
  const firstWord = words[0];

  for (const line of headerLines) {
    if (lastWord) {
      const lastMatch = labelRegex(lastWord).exec(line);
      if (lastMatch) {
        lastPos = lastMatch.index ?? 0;
      }
    }
    if (firstPos == null && firstWord) {
      const firstMatch = labelRegex(firstWord).exec(line);
      if (firstMatch) {
        firstPos = firstMatch.index ?? 0;
      }
    }
  }
  return lastPos ?? firstPos;
}

function findSingleWordLabelPosition(headerLines: string[], word: string): number | null {
  for (const line of headerLines) {
    const match = labelRegex(word).exec(line);
    if (match) {
      return match.index ?? 0;
    }
  }
  return null;
}

function labelPositionInHeaders(headerLines: string[], column: string): number | null {
  const exact = findExactLabelPosition(headerLines, column);
  if (exact != null) {
    return exact;
  }

  const words = column.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return null;
  }
  if (words.length > 1) {
    return findMultiWordLabelPosition(headerLines, words);
  }
  return findSingleWordLabelPosition(headerLines, words[0] ?? "");
}

type SummaryTableScan = {
  headerLines: string[];
  dataLine: string | null;
  dataCurrencyOnly: boolean;
};

function scanSummaryTableLines(lines: string[]): SummaryTableScan {
  const headerLines: string[] = [];
  let dataLine: string | null = null;
  let dataCurrencyOnly = true;

  for (const line of lines) {
    const stripped = line.trim();
    if (!stripped) {
      continue;
    }
    if (isTableSectionBoundary(line)) {
      break;
    }
    if (DATE_ONLY_LINE.test(stripped)) {
      continue;
    }
    const { amounts, currencyOnly } = summaryRowAmounts(line);
    if (amounts.length >= 3 && summaryTableHeaderSeen(headerLines)) {
      dataLine = line;
      dataCurrencyOnly = currencyOnly;
      break;
    }
    headerLines.push(line);
  }

  return { headerLines, dataLine, dataCurrencyOnly };
}

function summaryRowAmounts(line: string): {
  amounts: Array<{ amount: string; position: number }>;
  currencyOnly: boolean;
} {
  const allAmounts = amountsWithPositions(line, false);
  if (allAmounts.length >= 3) {
    return { amounts: allAmounts, currencyOnly: false };
  }
  const currencyAmounts = amountsWithPositions(line, true);
  if (currencyAmounts.length >= 3) {
    return { amounts: currencyAmounts, currencyOnly: true };
  }
  if (allAmounts.length >= 2) {
    return { amounts: allAmounts, currencyOnly: false };
  }
  if (currencyAmounts.length >= 2) {
    return { amounts: currencyAmounts, currencyOnly: true };
  }
  return { amounts: [], currencyOnly: true };
}

function columnIndexForLabel(
  headerLines: string[],
  dataLine: string,
  column: string,
  currencyOnly: boolean
): number | null {
  const labelPos = labelPositionInHeaders(headerLines, column);
  if (labelPos == null) {
    return null;
  }

  const amounts = amountsWithPositions(dataLine, currencyOnly);
  if (amounts.length === 0) {
    return null;
  }
  if (amounts.length === 1) {
    return 0;
  }

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < amounts.length; index += 1) {
    const distance = Math.abs((amounts[index]?.position ?? 0) - labelPos);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

export function summaryTableColumn(
  text: string,
  context: string,
  column: string,
  searchChars: number
): string | null {
  const ctxMatch = labelRegex(context).exec(text);
  if (!ctxMatch) {
    return null;
  }

  const window = text.slice(
    ctxMatch.index ?? 0,
    Math.min(text.length, (ctxMatch.index ?? 0) + searchChars)
  );
  const { headerLines, dataLine, dataCurrencyOnly } = scanSummaryTableLines(window.split("\n"));

  if (!dataLine || headerLines.length === 0) {
    return null;
  }

  const colIndex = columnIndexForLabel(headerLines, dataLine, column, dataCurrencyOnly);
  if (colIndex == null) {
    return null;
  }

  const amounts = amountsWithPositions(dataLine, dataCurrencyOnly);
  return amounts[colIndex]?.amount ?? null;
}

export function summaryTableRow(
  text: string,
  after: string,
  which: number,
  column: "opening" | "closing"
): string | null {
  const anchor = findLabel(text, after);
  if (!anchor) {
    return null;
  }

  const start = (anchor.index ?? 0) + anchor[0].length;
  const tail = text.slice(start, Math.min(text.length, start + 1200));
  let matchCount = 0;

  for (const line of tail.split("\n")) {
    const amounts = amountsWithPositions(line, true);
    if (amounts.length < 3) {
      continue;
    }
    matchCount += 1;
    if (matchCount < which) {
      continue;
    }
    return column === "opening" ? (amounts[0]?.amount ?? null) : (amounts.at(-1)?.amount ?? null);
  }
  return null;
}

function escapeLabelForRegex(label: string): string {
  return label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstAmountInFollowingLines(lines: string[], labelLineIndex: number): string | null {
  for (let j = labelLineIndex + 1; j < Math.min(lines.length, labelLineIndex + 8); j++) {
    const candidate = lines[j] ?? "";
    if (!candidate.trim() || DATE_ONLY_LINE.test(candidate.trim())) {
      continue;
    }
    const amount = firstAmountInText(candidate);
    if (amount) {
      return amount;
    }
  }
  return null;
}

function amountOnExactLabelLine(line: string, inlineLabel: RegExp): string | null {
  return firstAmountInText(line.replace(inlineLabel, ""));
}

/** Line-anchored label match (avoids fuzzy labelRegex subsequence false positives). */
export function exactLabelNextLineAmount(text: string, label: string): string | null {
  const labelPattern = new RegExp(`^\\s*${escapeLabelForRegex(label)}\\s*$`, "i");
  const inlineLabel = new RegExp(`^\\s*${escapeLabelForRegex(label)}\\s*`, "i");
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!labelPattern.test(line.trim())) {
      continue;
    }

    const inlineAmount = amountOnExactLabelLine(line, inlineLabel);
    if (inlineAmount) {
      return inlineAmount;
    }

    const following = firstAmountInFollowingLines(lines, i);
    if (following) {
      return following;
    }
  }

  return null;
}

export function labelSingleAmount(text: string, label: string): string | null {
  const match = findLabel(text, label);
  if (!match) {
    return null;
  }

  const start = (match.index ?? 0) + match[0].length;
  const windowEnd = Math.min(text.length, start + 400);
  for (const line of text.slice(start, windowEnd).split("\n")) {
    const stripped = line.trim();
    if (!stripped || DATE_ONLY_LINE.test(stripped)) {
      continue;
    }
    const parsed = firstAmountInText(line);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}

export function labelNextLineAmount(text: string, label: string): string | null {
  const match = findLabel(text, label);
  if (!match) {
    return null;
  }

  const start = (match.index ?? 0) + match[0].length;
  const tail = text.slice(start, Math.min(text.length, start + 400));
  const lineBreak = tail.indexOf("\n");
  if (lineBreak === -1) {
    return null;
  }

  for (const line of tail.slice(lineBreak + 1).split("\n")) {
    const stripped = line.trim();
    if (!stripped) {
      continue;
    }
    const currencyAmounts = amountsWithPositions(line, true);
    if (currencyAmounts[0]) {
      return currencyAmounts[0].amount;
    }
    const amounts = amountsWithPositions(line, false);
    if (amounts[0]) {
      return amounts[0].amount;
    }
  }
  return null;
}

export function singleAmountAfter(text: string, anchor: string): string | null {
  const match = findLabel(text, anchor);
  if (!match) {
    return null;
  }

  const start = (match.index ?? 0) + match[0].length;
  const window = text.slice(start, Math.min(text.length, start + 500));
  for (const line of window.split("\n")) {
    const stripped = line.trim();
    if (!stripped) {
      continue;
    }
    const amounts = amountsWithPositions(line, false);
    if (amounts.length === 1) {
      return amounts[0]?.amount ?? null;
    }
  }
  return null;
}

export function equationFirstAfter(text: string, anchor: string): string | null {
  const match = findLabel(text, anchor);
  if (!match) {
    return null;
  }

  const start = (match.index ?? 0) + match[0].length;
  const window = text.slice(start, Math.min(text.length, start + 600));
  for (const line of window.split("\n")) {
    if (!line.includes("=")) {
      continue;
    }
    const amounts = amountsWithPositions(line, false);
    if (amounts[0]) {
      return amounts[0].amount;
    }
  }
  return null;
}

export function edgeSummaryOpening(text: string): string | null {
  for (const line of text.slice(0, Math.min(text.length, 4000)).split("\n")) {
    const dateMatch = DATE_IN_LINE.exec(line);
    const amountMatch = RS_AMOUNT.exec(line);
    if (dateMatch && amountMatch && amountMatch.index != null && dateMatch.index != null) {
      if (amountMatch.index >= dateMatch.index) {
        return parseAmountString(amountMatch[0]);
      }
    }
  }
  return null;
}

export function edgeSummaryClosing(text: string): string | null {
  const match = RS_AMOUNT.exec(text.slice(0, Math.min(text.length, 3000)));
  return match ? parseAmountString(match[0]) : null;
}

function scanOutstandingAmounts(window: string): string | null {
  let lastSingle: string | null = null;
  let totalLineLast: string | null = null;

  for (const line of window.split("\n")) {
    const stripped = line.trim();
    if (!stripped) {
      continue;
    }
    if (OUTSTANDING_SECTION_END.test(stripped)) {
      break;
    }
    const amounts = amountsWithPositions(line, true);
    if (amounts.length === 0) {
      continue;
    }
    if (amounts.length === 1) {
      lastSingle = amounts[0]?.amount ?? null;
    } else if (amounts.length > 1 && TOTAL_ROW.test(stripped)) {
      totalLineLast = amounts.at(-1)?.amount ?? null;
    }
  }

  return lastSingle ?? totalLineLast;
}

export function totalOutstandingSectionAmount(text: string): string | null {
  const match = labelRegex("Total Outstanding").exec(text.slice(0, Math.min(text.length, 4000)));
  if (!match) {
    return null;
  }

  const tail = text.slice(match.index ?? 0);
  const lineBreak = tail.indexOf("\n");
  const windowStart = lineBreak === -1 ? tail.length : lineBreak + 1;
  const window = tail.slice(windowStart, Math.min(tail.length, windowStart + 500));
  return scanOutstandingAmounts(window);
}
