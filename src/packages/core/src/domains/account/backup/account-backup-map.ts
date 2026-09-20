import type { AccountType } from "@core/domains/account/constants";
import type { Account } from "@core/domains/account/entities/account";
import type {
  CreateAccountInput,
  UpdateAccountInput,
} from "@core/domains/account/services/account-service";

export function serializeAccountForBackup(
  account: Account,
  includeSecrets: boolean
): Record<string, unknown> {
  const base: Record<string, unknown> = {
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
      mail_rules: account.mail
        ? {
            subjects: [...account.mail.subjects],
            body_contains: [...account.mail.bodyContains],
            from: [...account.mail.fromAddresses],
          }
        : null,
      statement_rules: account.statement
        ? {
            text_contains: [...account.statement.textContains],
            text_not_contains: [...account.statement.textNotContains],
          }
        : null,
    };
  }

  return {
    ...base,
    has_passwords: account.hasPasswords(),
    has_mail_settings: account.hasMailSettings(),
    has_statement_rules: account.hasStatementRules(),
  };
}

export type ParsedBackupAccount = {
  backupId: string;
  match: {
    bank: string;
    variant?: string | null;
    accountType: AccountType;
    openingDate: string;
    accountNumber: string;
    closingDate?: string | null;
  };
  createInput: CreateAccountInput;
  updateInput: UpdateAccountInput;
};

function mailFromRaw(raw: Record<string, unknown> | null | undefined) {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return null;
  }
  return {
    subjects: Array.isArray(raw.subjects) ? raw.subjects.map(String) : [],
    bodyContains: Array.isArray(raw.body_contains) ? raw.body_contains.map(String) : [],
    fromAddresses: Array.isArray(raw.from) ? raw.from.map(String) : [],
  };
}

function statementFromRaw(raw: Record<string, unknown> | null | undefined) {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return null;
  }
  return {
    textContains: Array.isArray(raw.text_contains) ? raw.text_contains.map(String) : [],
    textNotContains: Array.isArray(raw.text_not_contains) ? raw.text_not_contains.map(String) : [],
  };
}

function applyOptionalBackupFields(
  entry: Record<string, unknown>,
  updateInput: UpdateAccountInput,
  passwords: string[]
): void {
  if ("passwords" in entry) {
    updateInput.passwords = passwords;
  }
  if ("mail_rules" in entry) {
    updateInput.mail = mailFromRaw(entry.mail_rules as Record<string, unknown> | null);
  }
  if ("statement_rules" in entry) {
    updateInput.statement = statementFromRaw(
      entry.statement_rules as Record<string, unknown> | null
    );
  }
}

function readBackupAccountFields(entry: Record<string, unknown>): {
  backupId: string;
  accountType: AccountType;
  bank: string;
  openingDate: string;
  accountNumber: string;
  variant: string | null;
  closingDate: string | null;
  passwords: string[];
} {
  const backupId = typeof entry.id === "string" ? entry.id : "";
  if (!backupId) {
    throw new Error("Accounts file has an invalid entry.");
  }
  const accountTypeRaw = entry.account_type;
  if (typeof accountTypeRaw !== "string") {
    throw new Error("Accounts file has an invalid account type.");
  }
  const passwords =
    "passwords" in entry && Array.isArray(entry.passwords) ? entry.passwords.map(String) : [];
  return {
    backupId,
    accountType: accountTypeRaw as AccountType,
    bank: typeof entry.bank === "string" ? entry.bank : "",
    openingDate: typeof entry.opening_date === "string" ? entry.opening_date : "",
    accountNumber: typeof entry.account_number === "string" ? entry.account_number : "",
    variant: typeof entry.variant === "string" ? entry.variant : ((entry.variant as null) ?? null),
    closingDate:
      entry.closing_date === null || typeof entry.closing_date === "string"
        ? (entry.closing_date as string | null)
        : null,
    passwords,
  };
}

export function parseBackupAccountEntry(raw: unknown): ParsedBackupAccount {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Accounts file has an invalid entry.");
  }
  const entry = raw as Record<string, unknown>;
  const fields = readBackupAccountFields(entry);
  const {
    backupId,
    accountType,
    bank,
    openingDate,
    accountNumber,
    variant,
    closingDate,
    passwords,
  } = fields;

  const updateInput: UpdateAccountInput = {
    bank,
    variant,
    accountType,
    openingDate,
    closingDate,
    accountNumber,
  };

  applyOptionalBackupFields(entry, updateInput, passwords);

  const createInput: CreateAccountInput = {
    bank,
    variant,
    accountType,
    openingDate,
    closingDate,
    accountNumber,
    passwords,
    mail: updateInput.mail === undefined ? null : updateInput.mail,
    statement: updateInput.statement === undefined ? null : updateInput.statement,
  };

  return {
    backupId,
    match: {
      bank,
      variant,
      accountType,
      openingDate,
      accountNumber,
      closingDate,
    },
    createInput,
    updateInput,
  };
}
