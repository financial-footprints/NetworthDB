import { parseAmountString, parseDateString } from "@statements/banks/helpers/index";
import {
  makeTransaction,
  type StatementParser,
  type Transaction,
} from "@statements/banks/parsers/common";

const TXT_LINE = /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d+)\s+(.+?)\s+([\d,]+\.\d{2})\s*(CR|DR)?\s*$/i;
const REWARD_SUFFIX = /\s+\d+\s*$/;
const TXN_HEADER = "Transaction Details:";
const MESSAGE_HEADER = "MESSAGE Details:";

type IciciCsvRow = {
  date: Date;
  description: string;
  amount: string;
  refNo: string | null;
};

function parseAmount(raw: string): string | null {
  const cleaned = raw.trim().replace(/[",]/g, "");
  if (!cleaned) {
    return null;
  }
  return parseAmountString(cleaned);
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields;
}

function findCsvSectionBounds(lines: string[]): { startIdx: number; endIdx: number } | null {
  let startIdx: number | null = null;
  let endIdx = lines.length;

  for (let index = 0; index < lines.length; index += 1) {
    const stripped = (lines[index] ?? "").trim().replace(/^"|"$/g, "");
    if (stripped.startsWith(TXN_HEADER)) {
      startIdx = index + 1;
    }
    if (stripped.startsWith(MESSAGE_HEADER)) {
      endIdx = index;
      break;
    }
  }

  if (startIdx == null) {
    return null;
  }
  return { startIdx, endIdx };
}

function iciciCsvAmountField(fields: string[]): string {
  if (fields.length > 6 && (fields[6]?.trim() ?? "").length > 0) {
    return fields[6] ?? "";
  }
  if (fields.length > 5) {
    return fields[5] ?? "";
  }
  return "";
}

function iciciCsvRefNoFromFields(fields: string[]): string | null {
  if (fields.length <= 1) {
    return null;
  }
  const candidate = fields[1]?.trim() ?? "";
  if (!candidate) {
    return null;
  }
  const allDigits = candidate.split("").every((c) => c >= "0" && c <= "9");
  if (allDigits && candidate.length <= 3) {
    return null;
  }
  return candidate;
}

function parseIciciCsvFields(fields: string[]): IciciCsvRow | null {
  const txnDate = parseDateString(fields[0] ?? "");
  if (!txnDate) {
    return null;
  }

  const description = fields.length > 2 ? (fields[2]?.trim() ?? "") : "";
  const amount = parseAmount(iciciCsvAmountField(fields));
  if (!amount) {
    return null;
  }

  return {
    date: txnDate,
    description,
    amount,
    refNo: iciciCsvRefNoFromFields(fields),
  };
}

function parseIciciCsvDataLines(lines: string[], startIdx: number, endIdx: number): IciciCsvRow[] {
  const rows: IciciCsvRow[] = [];
  let headerSeen = false;

  for (const line of lines.slice(startIdx, endIdx)) {
    const fields = parseCsvLine(line);
    if (fields.length === 0 || !fields.some((field) => field.trim().length > 0)) {
      continue;
    }
    if (!headerSeen) {
      if (fields[0]?.trim().toLowerCase() === "date") {
        headerSeen = true;
      }
      continue;
    }

    const row = parseIciciCsvFields(fields);
    if (row) {
      rows.push(row);
    }
  }

  return rows;
}

function parseIciciCsvRows(csvText: string): IciciCsvRow[] {
  const lines = csvText.split("\n");
  const bounds = findCsvSectionBounds(lines);
  if (!bounds) {
    return [];
  }
  return parseIciciCsvDataLines(lines, bounds.startIdx, bounds.endIdx);
}

function iciciCsvRowsToTransactions(rows: IciciCsvRow[], sourceFile: string): Transaction[] {
  return rows.map((row) => {
    const amountNum = Number.parseFloat(row.amount);
    const [credited, debited] =
      amountNum < 0 ? [Math.abs(amountNum).toFixed(2), "0.00"] : ["0.00", row.amount];
    return {
      date: row.date,
      description: row.description,
      credited,
      debited,
      sourceFile,
      refNo: row.refNo,
    };
  });
}

function parseIciciTxt(text: string, sourceFile: string): Transaction[] {
  const rows: Transaction[] = [];
  for (const raw of text.split("\n")) {
    const caps = TXT_LINE.exec(raw.trim());
    if (!caps) {
      continue;
    }
    const txnDate = parseDateString(caps[1] ?? "");
    if (!txnDate) {
      continue;
    }
    const refNo = (caps[2] ?? "").trim();
    const description = (caps[3] ?? "").trim().replace(REWARD_SUFFIX, "").trim();
    if (!description) {
      continue;
    }
    const amount = parseAmountString((caps[4] ?? "0").replace(/,/g, "")) ?? "0.00";
    const direction = caps[5]?.toUpperCase() === "CR" ? "CR" : "DR";
    rows.push(makeTransaction(txnDate, description, amount, direction, sourceFile, refNo));
  }
  return rows;
}

export const IciciStatementParser: StatementParser = {
  parse(text, sourceFile) {
    if (text.includes(TXN_HEADER)) {
      return iciciCsvRowsToTransactions(parseIciciCsvRows(text), sourceFile);
    }
    return parseIciciTxt(text, sourceFile);
  },
};
