const AMOUNT_TOKEN =
  /(?:\(?\s*(?:Rs\.?|INR|₹|[rC])\s*)?(-?,?\d[\d,]*(?:\.\d+)?|\.\d+)\s*(?:Cr|Dr|CR|DR)?\s*\)?/gi;
const CURRENCY_AMOUNT_TOKEN =
  /(?:\(?\s*(?:Rs\.?|INR|₹|[rC])\s*)?(-?,?\d[\d,]*\.\d+|\.\d+)\s*(?:Cr|Dr|CR|DR)?\s*\)?/gi;
const CID_PATTERN = /\(cid:\d+\)/gi;

const DEFAULT_BALANCE_TOLERANCE = 0.21;

export function parseAmountString(value: string): string | null {
  let working = value.trim();
  if (!working) {
    return null;
  }

  let negative = false;
  if (working.startsWith("(") && working.endsWith(")")) {
    negative = true;
    working = working.slice(1, -1).trim();
  }

  working = working.replace(/^(?:Rs\.?|INR|₹|[rC])\s*/i, "").trim();
  if (working.startsWith("-")) {
    negative = true;
    working = working.slice(1).trim();
  }
  working = working.replace(/^,+/g, "");
  working = working.replace(/\s*(?:Cr|Dr|CR|DR)\s*$/i, "").trim();
  working = working.replace(/,/g, "");
  if (!working) {
    return null;
  }

  const amount = Number.parseFloat(working);
  if (Number.isNaN(amount)) {
    return null;
  }

  let signed = negative ? -amount : amount;
  if (/\bCr\b/i.test(value)) {
    signed = -Math.abs(signed);
  } else if (/\bDr\b/i.test(value)) {
    signed = Math.abs(signed);
  }

  return signed.toFixed(2);
}

function isInsideCid(text: string, index: number): boolean {
  for (const match of text.matchAll(CID_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (start <= index && index < end) {
      return true;
    }
  }
  return false;
}

export function firstAmountInText(text: string): string | null {
  for (const match of text.matchAll(AMOUNT_TOKEN)) {
    const index = match.index ?? 0;
    if (isInsideCid(text, index)) {
      continue;
    }
    const parsed = parseAmountString(match[0]);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}

export function firstNotNone<T>(values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value != null) {
      return value;
    }
  }
  return null;
}

export function balancesMatch(left: string, right: string, tolerance?: number): boolean {
  const threshold = tolerance ?? DEFAULT_BALANCE_TOLERANCE;
  const leftParsed = parseAmountString(left);
  const rightParsed = parseAmountString(right);
  if (leftParsed && rightParsed) {
    return Math.abs(Number.parseFloat(leftParsed) - Number.parseFloat(rightParsed)) <= threshold;
  }
  return left === right;
}

export function amountsWithPositions(
  line: string,
  currencyOnly: boolean
): Array<{ amount: string; position: number }> {
  const pattern = currencyOnly ? CURRENCY_AMOUNT_TOKEN : AMOUNT_TOKEN;
  const found: Array<{ amount: string; position: number }> = [];
  for (const match of line.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (isInsideCid(line, index)) {
      continue;
    }
    const parsed = parseAmountString(match[0]);
    if (parsed) {
      found.push({ amount: parsed, position: index });
    }
  }
  return found;
}
