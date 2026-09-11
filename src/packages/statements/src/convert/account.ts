import type { Account } from "@ndb/core";
import type { Account as NativeAccount } from "../../native.d.ts";

export const account = {
  fromDomain: (account: Account): NativeAccount => ({
    id: account.id,
    userId: account.userId,
    accountType: account.accountType,
    bank: account.bank,
    variant: account.variant,
    label: account.label,
    openingDate: account.openingDate,
    closingDate: account.closingDate,
    accountNumber: account.accountNumber,
    passwords: [...account.passwords],
    mail: account.mail
      ? {
          subjects: [...account.mail.subjects],
          bodyContains: [...account.mail.bodyContains],
          fromAddresses: [...account.mail.fromAddresses],
        }
      : null,
    statement: account.statement
      ? {
          textContains: [...account.statement.textContains],
          textNotContains: [...account.statement.textNotContains],
        }
      : null,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  }),
};
