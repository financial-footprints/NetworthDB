import {
  purgeDropSections,
  sanitizeStatementText,
  trimByMarkers,
} from "@statements/banks/helpers/text";
import { PeriodSource } from "@statements/banks/shared/period-source";

export type BankHandler = {
  mailSubjects(): string[];
  trimStart(): string[];
  trimEnd(): string[];
  dropSections(): string[];
  cleanText(raw: string): string;
  getStatementDate(text: string): Date | null;
  getStatementPeriod(text: string): [Date | null, Date | null];
  getOpeningBalance(text: string): string | null;
  getClosingBalance(text: string): string | null;
  accountType(): string;
  yearDisplay(): string;
  isAnnualStatement(text: string): boolean;
  getAnnualPeriod(text: string): [Date, Date] | null;
  resolveCsvPeriodWithSource(csvText: string, filename: string): [string, PeriodSource];
};

export function createBankHandler(
  overrides: Partial<BankHandler> &
    Pick<
      BankHandler,
      | "mailSubjects"
      | "getStatementDate"
      | "getStatementPeriod"
      | "getOpeningBalance"
      | "getClosingBalance"
    >
): BankHandler {
  return {
    trimStart: () => [],
    trimEnd: () => [],
    dropSections: () => [],
    cleanText(raw) {
      const trimmed = trimByMarkers(raw, this.trimStart(), this.trimEnd());
      const sanitized = sanitizeStatementText(trimmed);
      return purgeDropSections(sanitized, this.dropSections());
    },
    accountType: () => "credit_card",
    yearDisplay: () => "calendar_year",
    isAnnualStatement: () => false,
    getAnnualPeriod: () => null,
    resolveCsvPeriodWithSource: () => ["unknown-month", PeriodSource.Unknown],
    ...overrides,
  };
}

export const CreditCardHandler = {
  defaultStatementPeriod(_text: string, statementDate: Date | null): [Date | null, Date | null] {
    if (statementDate) {
      return [null, statementDate];
    }
    return [null, null];
  },
};
