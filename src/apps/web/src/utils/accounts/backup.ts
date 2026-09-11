import {
  ACCOUNTS_JSON_NAME,
  backupAccountsFileSchema,
  backupSourcesFileSchema,
  SOURCES_JSON_NAME,
} from "@ndb/platform";
import type {
  Account,
  AccountType,
  AccountWritePayload,
} from "@web/utils/api/endpoints/accounts/types";
import type { SourceConfig, SourceWrite } from "@web/utils/api/endpoints/sources/types";
import { normalizeAccountDateInput } from "@web/utils/time";

export type BackupImportSummary = {
  created: number;
  updated: number;
  errors: string[];
};

export function accountToBackupPayload(account: Account): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: account.id,
    label: account.label,
    bank: account.bank,
    variant: account.variant,
    account_type: account.account_type,
    opening_date: account.opening_date,
    closing_date: account.closing_date,
    account_number: account.account_number,
  };

  if (account.passwords !== undefined) {
    payload.passwords = account.passwords;
  }
  if (account.mail_rules !== undefined) {
    payload.mail_rules = account.mail_rules;
  }
  if (account.statement_rules !== undefined) {
    payload.statement_rules = account.statement_rules;
  }
  if (account.has_passwords !== undefined) {
    payload.has_passwords = account.has_passwords;
  }
  if (account.has_mail_settings !== undefined) {
    payload.has_mail_settings = account.has_mail_settings;
  }
  if (account.has_statement_rules !== undefined) {
    payload.has_statement_rules = account.has_statement_rules;
  }

  return payload;
}

export function backupEntryToWritePayload(entry: Account): AccountWritePayload {
  return {
    bank: entry.bank,
    variant: entry.variant ?? null,
    account_number: entry.account_number.trim(),
    passwords: entry.passwords ?? [],
    opening_date: normalizeAccountDateInput(entry.opening_date),
    closing_date: entry.closing_date ? normalizeAccountDateInput(entry.closing_date) : null,
    statement: entry.statement_rules,
    mail: entry.mail_rules,
    type: entry.account_type,
  };
}

export function parseBackupAccountsJson(raw: string): Account[] {
  const parsed = backupAccountsFileSchema.parse(JSON.parse(raw) as unknown);
  return parsed.map((entry) => ({
    ...entry,
    account_type: entry.account_type as AccountType,
    mail_rules: entry.mail_rules
      ? {
          subjects: entry.mail_rules.subjects,
          body_contains: entry.mail_rules.body_contains,
          from: entry.mail_rules.from,
        }
      : undefined,
    statement_rules: entry.statement_rules
      ? {
          text_contains: entry.statement_rules.text_contains,
          text_not_contains: entry.statement_rules.text_not_contains,
        }
      : undefined,
  }));
}

export function parseBackupSourcesJson(raw: string | undefined): SourceConfig[] {
  if (!raw) {
    return [];
  }

  return backupSourcesFileSchema.parse(JSON.parse(raw) as unknown).map((source) => {
    if (source.type === "thunderbird") {
      return source;
    }

    if ("password" in source) {
      return {
        ...source,
        has_password: source.password.length > 0,
      };
    }

    return source;
  });
}

export function sourcesToWritePayload(sources: SourceConfig[]): SourceWrite[] {
  return sources.map((source) => {
    if (source.type === "thunderbird") {
      return source;
    }

    const write: SourceWrite = {
      id: source.id,
      type: "email",
      label: source.label,
      host: source.host,
      port: source.port,
      username: source.username,
      folder: source.folder,
      use_ssl: source.use_ssl,
    };

    if (source.password !== undefined) {
      write.password = source.password;
    }

    return write;
  });
}

export function buildBackupFiles(
  accounts: Account[],
  sources: SourceConfig[]
): Record<string, string> {
  const files: Record<string, string> = {
    [ACCOUNTS_JSON_NAME]: `${JSON.stringify(accounts.map(accountToBackupPayload), null, 2)}\n`,
  };

  if (sources.length > 0) {
    files[SOURCES_JSON_NAME] = `${JSON.stringify(sources, null, 2)}\n`;
  }

  return files;
}

export function downloadBackupBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export type BackupAccountEntry = {
  id?: string;
  bank: string;
  variant?: string | null;
  account_type: AccountType;
  opening_date: string;
  account_number?: string;
};

function normalizeVariant(variant: string | null | undefined): string {
  if (!variant || variant.toLowerCase() === "default") {
    return "";
  }
  return variant.trim();
}

function metadataKey(entry: BackupAccountEntry): string {
  return [
    entry.bank.trim().toLowerCase(),
    normalizeVariant(entry.variant),
    entry.opening_date,
    entry.account_type,
  ].join("|");
}

export function findExistingAccountId(
  entry: BackupAccountEntry,
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

  const accountNumber = entry.account_number?.trim();
  if (accountNumber) {
    const byNumber = existingAccounts.find(
      (account) => account.account_number.trim() === accountNumber && !usedIds.has(account.id)
    );
    if (byNumber) {
      usedIds.add(byNumber.id);
      return byNumber.id;
    }
  }

  const key = metadataKey(entry);
  const byMetadata = existingAccounts.find(
    (account) => metadataKey(account) === key && !usedIds.has(account.id)
  );
  if (byMetadata) {
    usedIds.add(byMetadata.id);
    return byMetadata.id;
  }

  return undefined;
}
