import type { Account, MailRules, StatementRules } from "@ndb/core";
import { accountListSchema, accountSchema } from "@ndb/platform";

function serializeMailRules(mailRules: MailRules | null) {
  if (mailRules === null) {
    return null;
  }

  return {
    subjects: [...mailRules.subjects],
    body_contains: [...mailRules.bodyContains],
    from: [...mailRules.fromAddresses],
  };
}

function serializeStatementRules(statementRules: StatementRules | null) {
  if (statementRules === null) {
    return null;
  }

  return {
    text_contains: [...statementRules.textContains],
    text_not_contains: [...statementRules.textNotContains],
  };
}

export function serializeAccountData(account: Account, includeSecrets: boolean) {
  const base = {
    id: account.id,
    label: account.label,
    account_type: account.accountType,
    bank: account.bank,
    variant: account.variant,
    opening_date: account.openingDate,
    closing_date: account.closingDate,
    account_number: account.accountNumber,
  };

  if (includeSecrets) {
    return {
      ...base,
      passwords: [...account.passwords],
      mail_rules: serializeMailRules(account.mail),
      statement_rules: serializeStatementRules(account.statement),
    };
  }

  return {
    ...base,
    has_passwords: account.hasPasswords(),
    has_mail_settings: account.hasMailSettings(),
    has_statement_rules: account.hasStatementRules(),
  };
}

export function serializeAccount(account: Account, includeSecrets: boolean) {
  return accountSchema.parse({
    data: serializeAccountData(account, includeSecrets),
    errors: [],
  });
}

export function serializeAccountList(items: Account[], total: number, includeSecrets: boolean) {
  return accountListSchema.parse({
    data: {
      items: items.map((account) => serializeAccountData(account, includeSecrets)),
      total,
    },
    errors: [],
  });
}
