import {
  contextRangeEnd,
  contextRangePeriod,
  dateAfterLabel,
  firstAmountInText,
  firstNotNone,
  labelRegex,
  labelSingleAmount,
  labelSingleDateEnd,
  parseDateString,
  purgeDropSections,
  sanitizeStatementText,
  summaryTableColumn,
  trimByMarkers,
} from "@statements/banks/helpers/index";

export const INVOICE_NO_LABEL = "Invoice No :";
export const V1_INVOICE_NO_MAX_OFFSET = 2500;
export const V2_INVOICE_NO_MIN_OFFSET = 4000;

export const MARKETING_MARKERS = ["Presenting Rupay Platinum", "Scan below QR", "PNB GENIE"];

const TRIM_END = ["********** End of Statement **********"];

export const DROP_SECTIONS = [
  "*TAD for the month consists of current month purchases",
  "Presenting Rupay Platinum",
  "PNB GENIE",
  "Scan and download",
  "Always get MORE",
  "Reward points details",
  "Why pay in Rupees",
  "CAUTION :",
  "Please make all Cheque",
];

const INVOICE_NUMBER = /\d{4}CC\d+/;
const CARD_LINE = /\d+X+\d+/;
const AMOUNT_ONLY = /^-?\d[\d,]*(?:\.\d+)?$/;
const STANDALONE_PERIOD_LINE = /(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(\d{1,2}-[A-Za-z]{3}-\d{4})/;

function prepareStatementText(raw: string, trimStart: string[]): string {
  const trimmed = trimByMarkers(raw, trimStart, TRIM_END);
  const sanitized = sanitizeStatementText(trimmed);
  return purgeDropSections(sanitized, DROP_SECTIONS);
}

function trimStatementBody(raw: string, trimStart: string[]): string {
  return trimByMarkers(raw, trimStart, TRIM_END);
}

export function detectLayout(text: string): boolean {
  const invoiceIdx = text.indexOf(INVOICE_NO_LABEL);
  if (invoiceIdx === -1) {
    return false;
  }

  const prefix = text.slice(0, invoiceIdx);
  if (MARKETING_MARKERS.some((marker) => prefix.includes(marker))) {
    return true;
  }
  if (invoiceIdx >= V2_INVOICE_NO_MIN_OFFSET) {
    return true;
  }
  if (invoiceIdx <= V1_INVOICE_NO_MAX_OFFSET) {
    return false;
  }
  return false;
}

function isLabelLine(line: string): boolean {
  const stripped = line.trim();
  return stripped.length > 0 && stripped.endsWith(":");
}

function stackedLabelAmount(text: string, label: string): string | null {
  const lines = text.split("\n");
  let start: number | null = null;
  const labels: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (start == null) {
      if (line.includes(INVOICE_NO_LABEL)) {
        start = index;
        labels.push(line.trim());
      }
      continue;
    }
    if (isLabelLine(line)) {
      labels.push(line.trim());
      continue;
    }
    break;
  }

  if (start == null || labels.length === 0) {
    return null;
  }

  const labelEnd = start + labels.length;
  const valueStart = lines.slice(labelEnd).findIndex((line) => {
    const stripped = line.trim();
    if (!stripped) {
      return false;
    }
    return (
      INVOICE_NUMBER.test(stripped) ||
      CARD_LINE.test(stripped) ||
      parseDateString(stripped) != null ||
      AMOUNT_ONLY.test(stripped)
    );
  });
  if (valueStart === -1) {
    return null;
  }

  const labelIndex = labels.findIndex((entry) => labelRegex(label).test(entry));
  if (labelIndex === -1) {
    return null;
  }

  const valueIndex = labelEnd + valueStart + labelIndex;
  const valueLine = lines[valueIndex];
  if (!valueLine) {
    return null;
  }
  return firstAmountInText(valueLine);
}

export function cleanText(raw: string): string {
  if (detectLayout(raw)) {
    return prepareStatementText(raw, [INVOICE_NO_LABEL]);
  }
  return prepareStatementText(raw, []);
}

export function getStatementDate(text: string): Date | null {
  if (detectLayout(text)) {
    const body = trimStatementBody(text, [INVOICE_NO_LABEL]);
    return firstNotNone([
      labelSingleDateEnd(body, "Invoice Date :"),
      dateAfterLabel(body, "Invoice Date :"),
    ]);
  }
  return firstNotNone([
    labelSingleDateEnd(text, "Invoice Date :"),
    dateAfterLabel(text, "Invoice Date :"),
    contextRangeEnd(text, "From", " to "),
  ]);
}

export function getStatementPeriod(text: string): [Date | null, Date | null] {
  if (detectLayout(text)) {
    return periodFromLayout(text);
  }
  return periodFromDefaultLayout(text);
}

function periodFromStandaloneLines(body: string): [Date | null, Date | null] | null {
  for (const line of body.split("\n")) {
    const match = STANDALONE_PERIOD_LINE.exec(line);
    if (!match) {
      continue;
    }
    const periodStart = parseDateString(match[1] ?? "");
    const periodEnd = parseDateString(match[2] ?? "");
    if (periodStart && periodEnd) {
      return [periodStart, periodEnd];
    }
  }
  return null;
}

function periodFromLayoutBody(body: string): [Date | null, Date | null] | null {
  const [start, end] = contextRangePeriod(body, "From", " to ");
  if (start && end) {
    return [start, end];
  }
  return periodFromStandaloneLines(body);
}

function periodFromLayout(text: string): [Date | null, Date | null] {
  const body = trimStatementBody(text, [INVOICE_NO_LABEL]);
  const period = periodFromLayoutBody(body);
  if (period) {
    return period;
  }
  return [null, getStatementDate(text)];
}

function periodFromDefaultLayout(text: string): [Date | null, Date | null] {
  const [start, end] = contextRangePeriod(text, "From", " to ");
  if (start && end) {
    return [start, end];
  }
  return [null, getStatementDate(text)];
}

export function getOpeningBalance(text: string): string | null {
  const body = detectLayout(text) ? trimStatementBody(text, [INVOICE_NO_LABEL]) : text;
  return summaryTableColumn(body, "Account Summary", "Previous Balance", 2000);
}

export function getClosingBalance(text: string): string | null {
  const body = detectLayout(text) ? trimStatementBody(text, [INVOICE_NO_LABEL]) : text;
  return firstNotNone([
    summaryTableColumn(body, "Account Summary", "Total Amount Due for Month", 2000),
    stackedLabelAmount(body, "Total Amount Due for Month"),
    stackedLabelAmount(body, "Total Amount Due"),
    labelSingleAmount(body, "Total Amount Due for Month"),
    labelSingleAmount(body, "Total Amount Due :"),
  ]);
}
