import {
  amountsWithPositions,
  equationFirstAfter,
  findLabel,
  firstAmountInText,
  firstNotNone,
  labelRegex,
} from "@statements/banks/helpers/index";

const ORPHAN_CR_DR = /^(?:CR|DR)$/i;
const DATE_OR_RANGE_LINE =
  /^\d{1,2}\/(?:\d{1,2}|[A-Za-z]{3})\/\d{2,4}(?:\s+-\s+\d{1,2}\/(?:\d{1,2}|[A-Za-z]{3})\/\d{2,4})?$/i;
const DATE_ONLY_LINE = /^\d{1,2}\/(?:\d{1,2}|[A-Za-z]{3})\/\d{2,4}$/i;
const AMOUNT_TOKEN =
  /(?:\(?\s*(?:Rs\.?|INR|₹|[rC])\s*)?(-?,?\d[\d,]*(?:\.\d+)?|\.\d+)\s*(?:Cr|Dr|CR|DR)?\s*\)?/gi;
const BONUS_BOUNDARY = /Bonus\/Reward|Transaction Date/i;
const CLOSING_SCAN_STOP = /Credit Limit|Page \d+ of|Late payment fee would be levied/i;
const SUMMARY_TABLE_HEADER = /Opening|Balance|Total|Previous/i;

function signedCreditCardAmount(parsed: string): string {
  const dec = Number.parseFloat(parsed);
  if (Number.isNaN(dec)) {
    return "0.00";
  }
  if (dec > 0) {
    return (-dec).toFixed(2);
  }
  return parsed;
}

function wowLineAmount(line: string): string | null {
  const stripped = line.trim();
  if (!stripped || isSummaryDateLine(stripped)) {
    return null;
  }
  for (const { amount } of amountsWithPositions(line, true)) {
    if (amount !== "0.00") {
      return amount;
    }
  }
  return null;
}

function nonZeroAmount(line: string): string | null {
  return wowLineAmount(line);
}

function summarySectionEnd(text: string): number {
  const transactions = text.indexOf("YOUR TRANSACTIONS");
  if (transactions !== -1) {
    return transactions;
  }
  const important = text.indexOf("IMPORTANT INFORMATION");
  if (important !== -1) {
    return important;
  }
  return text.length;
}

function openingAmountFromRow(amounts: Array<{ amount: string; position: number }>): string | null {
  for (const idx of [1, 2, 0, 3]) {
    if (idx >= amounts.length) {
      continue;
    }
    const opening = amounts[idx]?.amount;
    if (!opening || opening === "0.00") {
      continue;
    }
    return signedCreditCardAmount(opening);
  }
  return null;
}

function isSummaryDateLine(line: string): boolean {
  const stripped = line.trim();
  return DATE_ONLY_LINE.test(stripped) || DATE_OR_RANGE_LINE.test(stripped);
}

export function joinOrphanCrDr(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  for (const line of lines) {
    const stripped = line.trim();
    if (ORPHAN_CR_DR.test(stripped) && result.length > 0) {
      while (result.length > 0 && result[result.length - 1]?.trim() === "") {
        result.pop();
      }
      const last = result.pop();
      if (last) {
        result.push(`${last.trimEnd()} ${stripped}`);
      }
      continue;
    }
    result.push(line);
  }
  return result.join("\n");
}

export function normalizeCrDrLayout(text: string): string {
  return joinOrphanCrDr(text);
}

function summaryRowAmounts(line: string): [Array<{ amount: string; position: number }>, boolean] {
  const all = amountsWithPositions(line, false);
  if (all.length >= 3) {
    return [all, false];
  }
  const currency = amountsWithPositions(line, true);
  if (currency.length >= 3) {
    return [currency, true];
  }
  if (all.length >= 2) {
    return [all, false];
  }
  if (currency.length >= 2) {
    return [currency, true];
  }
  return [[], true];
}

function summaryTableHeaderSeen(headerLines: string[]): boolean {
  return headerLines.some((line) => SUMMARY_TABLE_HEADER.test(line));
}

function countRPrefixedAmounts(line: string): number {
  let count = 0;
  for (const match of line.matchAll(AMOUNT_TOKEN)) {
    if (match[0].trim().toLowerCase().startsWith("r")) {
      count++;
    }
  }
  return count;
}

function classicSummaryRowAmounts(
  line: string,
  headerLines: string[]
): Array<{ amount: string; position: number }> | null {
  const [, currencyOnly] = summaryRowAmounts(line);
  if (countRPrefixedAmounts(line) >= 4 && summaryTableHeaderSeen(headerLines)) {
    const amounts = amountsWithPositions(line, currencyOnly);
    if (amounts.length >= 4) {
      return amounts;
    }
  }
  return null;
}

function classicSummaryAmounts(text: string): Array<{ amount: string; position: number }> | null {
  const ctxMatch = labelRegex("STATEMENT SUMMARY").exec(text);
  if (!ctxMatch) {
    return null;
  }

  const ctxStart = ctxMatch.index ?? 0;
  const headerLines: string[] = [];
  const window = text.slice(ctxStart, Math.min(text.length, ctxStart + 2000));
  for (const line of window.split("\n")) {
    const stripped = line.trim();
    if (!stripped) {
      continue;
    }
    if (BONUS_BOUNDARY.test(line)) {
      break;
    }
    if (isSummaryDateLine(stripped)) {
      continue;
    }
    const rowAmounts = classicSummaryRowAmounts(line, headerLines);
    if (rowAmounts) {
      return rowAmounts;
    }
    const [amounts] = summaryRowAmounts(line);
    if (amounts.length < 3) {
      headerLines.push(line);
    }
  }
  return null;
}

function classicOpening(text: string): string | null {
  const amounts = classicSummaryAmounts(text);
  if (!amounts) {
    return null;
  }
  return openingAmountFromRow(amounts);
}

function classicClosing(text: string): string | null {
  const amounts = classicSummaryAmounts(text);
  if (!amounts) {
    return null;
  }
  const last = amounts.at(-1);
  if (!last) {
    return null;
  }
  return signedCreditCardAmount(last.amount);
}

function openingEquationAmount(text: string): string | null {
  const match = findLabel(text, "Opening Balance");
  if (!match) {
    return null;
  }

  const end = summarySectionEnd(text);
  const start = (match.index ?? 0) + match[0].length;
  let candidate: string | null = null;
  for (const line of text.slice(start, end).split("\n")) {
    if (isSummaryDateLine(line.trim())) {
      continue;
    }
    const amounts = amountsWithPositions(line, false);
    if (amounts.length >= 3 && amountsWithPositions(line, true).length > 0) {
      const opening = openingAmountFromRow(amounts);
      if (opening) {
        candidate = opening;
      }
    }
  }
  return candidate;
}

function labelPrecedingAmount(text: string, label: string, maxLines: number): string | null {
  const match = findLabel(text, label);
  if (!match) {
    return null;
  }

  const lines = text.slice(0, match.index ?? 0).split("\n");
  for (const line of lines.slice(-maxLines).reverse()) {
    const amount = nonZeroAmount(line);
    if (amount) {
      return amount;
    }
  }
  return null;
}

function labelFollowingAmount(text: string, label: string, maxLines: number): string | null {
  const match = findLabel(text, label);
  if (!match) {
    return null;
  }

  const start = (match.index ?? 0) + match[0].length;
  for (const line of text.slice(start).split("\n").slice(0, maxLines)) {
    if (findLabel(line, "YOUR TRANSACTIONS")) {
      break;
    }
    const amount = nonZeroAmount(line);
    if (amount) {
      return amount;
    }
  }
  return null;
}

function labelNearbyAmount(text: string, label: string): string | null {
  return firstNotNone([
    labelPrecedingAmount(text, label, 6),
    labelFollowingAmount(text, label, 10),
  ]);
}

function labelLastNonZeroAmount(text: string, label: string): string | null {
  const end = summarySectionEnd(text);
  const section = text.slice(0, end);
  const pattern = new RegExp(labelRegex(label).source, "gi");
  let lastMatch: RegExpMatchArray | null = null;
  for (const match of section.matchAll(pattern)) {
    lastMatch = match;
  }
  if (!lastMatch) {
    return null;
  }

  const start = (lastMatch.index ?? 0) + lastMatch[0].length;
  let last: string | null = null;
  for (const line of text.slice(start, end).split("\n")) {
    if (CLOSING_SCAN_STOP.test(line)) {
      break;
    }
    const amount = nonZeroAmount(line);
    if (amount) {
      last = amount;
    }
  }
  return last;
}

function stackedSummaryClosing(text: string): string | null {
  const section = text.slice(0, summarySectionEnd(text));
  let last: string | null = null;
  for (const line of section.split("\n")) {
    const amount = nonZeroAmount(line);
    if (amount) {
      last = amount;
    }
  }
  return last;
}

function inlineEquationAmount(text: string, label: string): string | null {
  const match = findLabel(text, label);
  if (!match) {
    return null;
  }

  const matchStart = match.index ?? 0;
  const matchEnd = matchStart + match[0].length;
  const beforeNewline = text.lastIndexOf("\n", matchStart - 1);
  const lineStart = beforeNewline === -1 ? 0 : beforeNewline + 1;
  const afterMatch = text.slice(matchEnd);
  const newlineIdx = afterMatch.indexOf("\n");
  const lineEnd = newlineIdx === -1 ? text.length : matchEnd + newlineIdx;
  return firstAmountInText(text.slice(lineStart, lineEnd));
}

function wowUsesRewardsSidecarOpening(text: string): boolean {
  return /Rewards Summary/i.test(text);
}

export function wowOpeningBalance(text: string): string | null {
  const normalized = normalizeCrDrLayout(text);
  if (wowUsesRewardsSidecarOpening(normalized)) {
    return firstNotNone([
      labelNearbyAmount(normalized, "Opening Balance"),
      inlineEquationAmount(normalized, "Opening Balance"),
      openingEquationAmount(normalized),
      classicOpening(normalized),
    ]);
  }

  return firstNotNone([
    classicOpening(normalized),
    inlineEquationAmount(normalized, "Opening Balance"),
    openingEquationAmount(normalized),
    labelNearbyAmount(normalized, "Opening Balance"),
  ]);
}

export function wowClosingBalance(text: string): string | null {
  const normalized = normalizeCrDrLayout(text);
  return firstNotNone([
    inlineEquationAmount(normalized, "Total Amount Due"),
    equationFirstAfter(normalized, "Total Amount Due"),
    classicClosing(normalized),
    labelLastNonZeroAmount(normalized, "Total Amount Due"),
    stackedSummaryClosing(normalized),
  ]);
}
