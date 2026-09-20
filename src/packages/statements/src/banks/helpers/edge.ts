const OPENING_SUMMARY_LINE =
  /^(\s*)((?:\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+)?(Rs\.?\s*-?\d[\d,]*(?:\.\d+)?|\.\d+)\s*$/;
const AMOUNT_ONLY_LINE = /^(\s*)(Rs\.?\s*-?\d[\d,]*(?:\.\d+)?|\.\d+)\s*$/;
const DATE_BEFORE_AMOUNT = /\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/;
const RS_AMOUNT = /Rs\.?\s*(-?\d[\d,]*(?:\.\d+)?|\.\d+)/;

export const EDGE_SUMMARY_LABELS = [
  "Opening Balance",
  "Spends",
  "Cash Advances",
  "Fees & Charges",
  "Interest Charges",
  "Repayments & Refunds",
  "Paid via points",
  "Total Amount Due",
] as const;

type EdgeSummaryEntry = [number, string, [number, number]];

function isOpeningSummaryLine(line: string): boolean {
  if (!OPENING_SUMMARY_LINE.test(line)) {
    return false;
  }
  const dateMatch = DATE_BEFORE_AMOUNT.exec(line);
  const amountMatch = RS_AMOUNT.exec(line);
  if (!dateMatch || !amountMatch || dateMatch.index == null || amountMatch.index == null) {
    return false;
  }
  return dateMatch.index < amountMatch.index;
}

function findEdgeSummaryStart(lines: string[]): number | null {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (isOpeningSummaryLine(line)) {
      return index;
    }
  }
  return null;
}

function collectEdgeAmountLines(lines: string[], startIdx: number): EdgeSummaryEntry[] | null {
  const collected: EdgeSummaryEntry[] = [];
  let index = startIdx;
  while (index < lines.length && collected.length < EDGE_SUMMARY_LABELS.length) {
    const line = lines[index] ?? "";
    if (line.trim().length === 0) {
      index += 1;
      continue;
    }
    const matchLine = AMOUNT_ONLY_LINE.exec(line) ?? OPENING_SUMMARY_LINE.exec(line);
    const amountMatch = RS_AMOUNT.exec(line);
    if (!matchLine || !amountMatch || amountMatch.index == null) {
      break;
    }
    collected.push([index, line, [amountMatch.index, amountMatch.index + amountMatch[0].length]]);
    index += 1;
  }

  if (collected.length !== EDGE_SUMMARY_LABELS.length) {
    return null;
  }
  return collected;
}

function applyEdgeLabels(lines: string[], collected: EdgeSummaryEntry[]): void {
  for (let labelIndex = 0; labelIndex < collected.length; labelIndex += 1) {
    const entry = collected[labelIndex];
    if (!entry) {
      continue;
    }
    const [lineIndex, line, [amountStart]] = entry;
    const label = EDGE_SUMMARY_LABELS[labelIndex] ?? "";
    const prefix = line.match(/^\s*/)?.[0] ?? "";
    const beforeAmount = line.slice(0, amountStart).trimEnd();
    const amountAndRest = line.slice(amountStart);
    if (beforeAmount.trim().length > 0) {
      const left = beforeAmount.slice(prefix.length).trim();
      lines[lineIndex] = `${prefix}${label}  ${left}  ${amountAndRest.trimStart()}`;
    } else {
      lines[lineIndex] = `${prefix}${label}  ${amountAndRest.trimStart()}`;
    }
  }
}

export function injectEdgeSummaryLabels(text: string): string {
  if (text.trim().length === 0) {
    return text;
  }
  if (text.includes("Opening Balance") && text.includes("Total Amount Due")) {
    return text;
  }

  const lines = text.split("\n");
  const startIdx = findEdgeSummaryStart(lines);
  if (startIdx == null) {
    return text;
  }

  const collected = collectEdgeAmountLines(lines, startIdx);
  if (!collected) {
    return text;
  }

  applyEdgeLabels(lines, collected);
  return lines.join("\n");
}
