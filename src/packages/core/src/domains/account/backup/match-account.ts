import type { AccountType } from "@core/domains/account/constants";
import { Account } from "@core/domains/account/entities/account";

export type BackupAccountMatchEntry = {
  id?: string;
  bank: string;
  variant?: string | null;
  accountType: AccountType;
  openingDate: string;
  accountNumber?: string;
};

function metadataKey(entry: BackupAccountMatchEntry): string {
  const variant = Account.normalize.variant(entry.variant) ?? "";
  return [entry.bank.trim().toLowerCase(), variant, entry.openingDate, entry.accountType].join("|");
}

function accountMetadataKey(account: Account): string {
  const variant = Account.normalize.variant(account.variant) ?? "";
  return [
    account.bank.trim().toLowerCase(),
    variant,
    account.openingDate,
    account.accountType,
  ].join("|");
}

export function findExistingAccountId(
  entry: BackupAccountMatchEntry,
  existingAccounts: Account[],
  usedIds: Set<string>
): string | undefined {
  if (entry.id) {
    const byId = existingAccounts.find((account) => account.id === entry.id);
    if (byId && !usedIds.has(byId.id)) {
      usedIds.add(byId.id);
      return byId.id;
    }
  }

  const accountNumber = entry.accountNumber?.trim();
  if (accountNumber) {
    const byNumber = existingAccounts.find(
      (account) => account.accountNumber.trim() === accountNumber && !usedIds.has(account.id)
    );
    if (byNumber) {
      usedIds.add(byNumber.id);
      return byNumber.id;
    }
  }

  const key = metadataKey(entry);
  const byMetadata = existingAccounts.find(
    (account) => accountMetadataKey(account) === key && !usedIds.has(account.id)
  );
  if (byMetadata) {
    usedIds.add(byMetadata.id);
    return byMetadata.id;
  }

  return undefined;
}
