export const INSTRUMENT_ACCOUNT_TYPES = [
  "bank",
  "credit_card",
  "loan",
  "stocks",
  "bonds",
  "mutual_funds",
] as const;

export const STATEMENT_ACCOUNT_TYPES = ["bank", "credit_card"] as const;

export const SYSTEM_ACCOUNT_TYPES = ["unknown", "revenue", "expense", "tumbler"] as const;

export const ACCOUNT_TYPES = [
  "bank",
  "credit_card",
  "loan",
  "stocks",
  "bonds",
  "mutual_funds",
  "unknown",
  "revenue",
  "expense",
  "tumbler",
] as const;

export type InstrumentAccountType = (typeof INSTRUMENT_ACCOUNT_TYPES)[number];
export type SystemAccountType = (typeof SYSTEM_ACCOUNT_TYPES)[number];
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const SYSTEM_ACCOUNT_LABELS: Record<SystemAccountType, string> = {
  unknown: "Unknown",
  revenue: "Revenue",
  expense: "Expense",
  tumbler: "Tumbler",
};

export function isSystemAccountType(type: string): type is SystemAccountType {
  return (SYSTEM_ACCOUNT_TYPES as readonly string[]).includes(type);
}

export function isInstrumentAccountType(type: string): type is InstrumentAccountType {
  return (INSTRUMENT_ACCOUNT_TYPES as readonly string[]).includes(type);
}

export function supportsStatements(type: AccountType): boolean {
  return (STATEMENT_ACCOUNT_TYPES as readonly string[]).includes(type);
}
