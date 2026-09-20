import type { AccountType } from "@core/domains/account/constants";
import { isSystemAccountType } from "@core/domains/account/constants";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: "Bank",
  credit_card: "Credit Card",
  loan: "Loan",
  stocks: "Stocks",
  bonds: "Bonds",
  mutual_funds: "Mutual Funds",
  unknown: "Unknown",
  revenue: "Revenue",
  expense: "Expense",
  tumbler: "Tumbler",
};

export function accountRegistryKey(bank: string, variant: string | null | undefined): string {
  const trimmed = variant?.trim().toLowerCase();
  const variantKey = trimmed && trimmed !== "default" ? trimmed : "default";
  return `${bank.trim().toLowerCase()}/${variantKey}`;
}

export function resolveCreditCardCatalogTitle(
  bank: string,
  variant: string | null | undefined,
  catalogByKey: ReadonlyMap<string, string>
): string | null {
  const primary = catalogByKey.get(accountRegistryKey(bank, variant));
  if (primary) {
    return primary;
  }
  if (accountRegistryKey(bank, variant) === accountRegistryKey(bank, "default")) {
    return null;
  }
  return catalogByKey.get(accountRegistryKey(bank, "default")) ?? null;
}

export type AccountPickerLabelInput = {
  accountType: string;
  label: string;
  bank?: string;
  variant?: string | null;
};

export function formatInstrumentAccountPickerLabel(
  account: AccountPickerLabelInput,
  catalogByKey?: ReadonlyMap<string, string>
): string {
  if (isSystemAccountType(account.accountType)) {
    return account.label;
  }
  const typeLabel = ACCOUNT_TYPE_LABELS[account.accountType as AccountType] ?? account.accountType;
  let title = account.label;
  if (account.accountType === "credit_card" && account.bank && catalogByKey) {
    const catalogTitle = resolveCreditCardCatalogTitle(account.bank, account.variant, catalogByKey);
    if (catalogTitle) {
      title = catalogTitle;
    }
  }
  return `${typeLabel} - ${title}`;
}
