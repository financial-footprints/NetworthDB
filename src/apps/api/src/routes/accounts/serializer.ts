import type { Account, AccountListItem, MailRules, StatementRules } from "@ndb/core";
import type { AccountType } from "@ndb/platform";
import { accountListSchema, accountSchema, systemAccountsSchema } from "@ndb/platform";

function serializeMailRules(mailRules: MailRules | null) {
  if (mailRules === null) {
    return null;
  }

  return {
    subjects: [...mailRules.subjects],
    bodyContains: [...mailRules.bodyContains],
    fromAddresses: [...mailRules.fromAddresses],
  };
}

function serializeStatementRules(statementRules: StatementRules | null) {
  if (statementRules === null) {
    return null;
  }

  return {
    textContains: [...statementRules.textContains],
    textNotContains: [...statementRules.textNotContains],
  };
}

export function serializeAccountData(account: Account, includeSecrets: boolean) {
  const base = {
    id: account.id,
    label: account.label,
    accountType: account.accountType,
    bank: account.bank,
    variant: account.variant,
    openingDate: account.openingDate,
    closingDate: account.closingDate,
    accountNumber: account.accountNumber,
  };

  if (includeSecrets) {
    return {
      ...base,
      passwords: [...account.passwords],
      mail: serializeMailRules(account.mail),
      statement: serializeStatementRules(account.statement),
    };
  }

  return {
    ...base,
    hasPasswords: account.hasPasswords(),
    hasMailSettings: account.hasMailSettings(),
    hasStatementRules: account.hasStatementRules(),
  };
}

export function serializeAccount(account: Account, includeSecrets: boolean) {
  return accountSchema.parse({
    data: serializeAccountData(account, includeSecrets),
  });
}

export function serializeSystemAccounts(
  items: Array<{ id: string; label: string; accountType: AccountType }>
) {
  return systemAccountsSchema.parse({
    data: {
      items: items.map((item) => ({
        id: item.id,
        label: item.label,
        accountType: item.accountType,
      })),
    },
  });
}

export function serializeAccountList(
  items: AccountListItem[],
  total: number,
  includeSecrets: boolean
) {
  return accountListSchema.parse({
    items: items.map(({ account, currentBalance }) => ({
      ...serializeAccountData(account, includeSecrets),
      currentBalance,
    })),
    total,
  });
}
