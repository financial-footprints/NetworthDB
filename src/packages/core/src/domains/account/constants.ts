export const ACCOUNT_TYPES = ["credit_card", "bank_account"] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];
