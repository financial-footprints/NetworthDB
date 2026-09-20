import { parseAmountString, parseDateString } from "@statements/banks/helpers/index";

export type Transaction = {
  date: Date;
  description: string;
  credited: string;
  debited: string;
  sourceFile: string;
  refNo: string | null;
};

const AMOUNT = /(?:Rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)/g;
const DR_CR_TOKEN = /\b(DR|CR|Dr|Cr)\b/g;
const DD_MON_RS_DR_CR_LINE =
  /^\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})\s+(.+?)\s+Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s*(Dr|Cr)\s*$/i;
const DATE_PREFIX_SLASH = /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+/;
const DATE_PREFIX_DASH_NUM = /^(\d{1,2}-\d{1,2}-\d{2,4})\s+/;
const DATE_PREFIX_DASH_MON = /^(\d{1,2}-[A-Za-z]{3}-\d{2,4})\s+/;
const DATE_PREFIX_SPACE_MON = /^(\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})\s+/;
const RS_SUFFIX = /\s*Rs\.?\s*$/i;

function parseDecimal(raw: string): string {
  const parsed = parseAmountString(raw.replace(/,/g, ""));
  return parsed ?? "0.00";
}

export function creditedDebited(amount: string, direction: string): [string, string] {
  if (direction.toUpperCase().startsWith("C")) {
    return [amount, "0.00"];
  }
  return ["0.00", amount];
}

export function makeTransaction(
  txnDate: Date,
  description: string,
  amount: string,
  direction: string,
  sourceFile: string,
  refNo: string | null = null
): Transaction {
  const [credited, debited] = creditedDebited(amount, direction);
  return {
    date: txnDate,
    description,
    credited,
    debited,
    sourceFile,
    refNo,
  };
}

function splitDirectionSuffix(rest: string): [string, string] {
  const matches = [...rest.matchAll(DR_CR_TOKEN)];
  if (matches.length === 0) {
    return [rest.trim(), "DR"];
  }
  const last = matches.at(-1);
  if (!last || last.index == null) {
    return [rest.trim(), "DR"];
  }
  const direction = last[0]?.toUpperCase().startsWith("C") ? "CR" : "DR";
  return [rest.slice(0, last.index).trim(), direction];
}

export function parseDatedAmountLine(line: string): [Date, string, string, string] | null {
  const stripped = line.trim();
  if (!stripped) {
    return null;
  }

  const caps =
    DATE_PREFIX_SLASH.exec(stripped) ??
    DATE_PREFIX_DASH_NUM.exec(stripped) ??
    DATE_PREFIX_DASH_MON.exec(stripped) ??
    DATE_PREFIX_SPACE_MON.exec(stripped);
  if (!caps) {
    return null;
  }

  const txnDate = parseDateString(caps[1] ?? "");
  if (!txnDate) {
    return null;
  }

  const restStart = caps[0]?.length ?? 0;
  const [restBody, direction] = splitDirectionSuffix(stripped.slice(restStart).trim());

  const amountMatches = [...restBody.matchAll(AMOUNT)];
  if (amountMatches.length === 0) {
    return null;
  }
  const last = amountMatches.at(-1);
  if (!last || last.index == null) {
    return null;
  }

  const amount = parseDecimal(last[0] ?? "0");
  const description = restBody.slice(0, last.index).trim().replace(RS_SUFFIX, "").trim();
  if (!description) {
    return null;
  }

  return [txnDate, description, amount, direction];
}

export function lineHasDrCrMarker(line: string): boolean {
  return DR_CR_TOKEN.test(line);
}

export function parseDdMonRsDrCrLine(line: string): [Date, string, string, string] | null {
  const caps = DD_MON_RS_DR_CR_LINE.exec(line.trim());
  if (!caps) {
    return null;
  }

  const txnDate = parseDateString(caps[1] ?? "");
  if (!txnDate) {
    return null;
  }

  const description = (caps[2] ?? "").trim();
  if (!description) {
    return null;
  }

  const amount = parseDecimal(caps[3] ?? "0");
  const direction = (caps[4] ?? "").toUpperCase().startsWith("C") ? "CR" : "DR";
  return [txnDate, description, amount, direction];
}

export function parseStopAtEndLines(
  text: string,
  lineParser: (line: string) => [Date, string, string, string] | null,
  sourceFile: string,
  stopMarker: string
): Transaction[] {
  const rows: Transaction[] = [];
  for (const line of text.split("\n")) {
    if (line.includes(stopMarker)) {
      break;
    }
    const parsed = lineParser(line);
    if (!parsed) {
      continue;
    }
    const [txnDate, description, amount, direction] = parsed;
    const cleaned = description.replace(/Rs\./g, "").trim();
    if (!cleaned) {
      continue;
    }
    rows.push(makeTransaction(txnDate, cleaned, amount, direction, sourceFile, null));
  }
  return rows;
}

export type StatementParser = {
  parse(text: string, sourceFile: string): Transaction[];
};
