import { SYSTEM_ACCOUNT_LABELS, SYSTEM_ACCOUNT_TYPES } from "@core/domains/account/constants";
import { Account } from "@core/domains/account/entities/account";
import type { AccountRepository } from "@core/domains/account/repositories/account-repository";
import { Time } from "@core/shared/time";

export const ACCOUNT_LIST_STATUSES = ["open", "closed", "all"] as const;

export type AccountListStatus = (typeof ACCOUNT_LIST_STATUSES)[number];

/** ISO calendar date `YYYY-MM-DD` (UTC “today” on the server for API list). */
export function isAccountClosedForList(closingDate: string | null, asOfIsoDate: string): boolean {
  return closingDate !== null && closingDate < asOfIsoDate;
}

export async function ensureSystemAccounts(
  accounts: AccountRepository,
  userId: string
): Promise<void> {
  const openingDate = Time.utcTodayIsoDate();
  for (const accountType of SYSTEM_ACCOUNT_TYPES) {
    const existing = await accounts.findByFilters({ userId, accountType });
    if (existing.length > 0) {
      continue;
    }
    const label = SYSTEM_ACCOUNT_LABELS[accountType];
    await accounts.create(
      Account.create({
        userId,
        accountType,
        bank: label,
        variant: null,
        openingDate,
        closingDate: null,
        accountNumber: "-",
        passwords: [],
        mail: null,
        statement: null,
      })
    );
  }
}
