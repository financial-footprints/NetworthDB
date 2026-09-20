import type { StatementFileInput } from "@ndb/core";
import {
  statementRelativePath,
  statementTxtRelative,
  transactionsCsvRelative,
} from "@statements/storage/vault/path";
import type { VaultStore } from "@statements/storage/vault/store";
import { accountWorkspace, listFiles } from "@statements/storage/vault/workspace";

function canonicalStatementExists(
  store: VaultStore,
  accountType: string,
  accountId: string,
  statementDate: string,
  format: string
): boolean {
  const relative = statementRelativePath(accountType, accountId, statementDate, format);
  return store.exists(relative);
}

export function readStatementFile(store: VaultStore, input: StatementFileInput): Buffer | null {
  const statementDate = input.statementDate;
  if (!statementDate) {
    throw new Error("statements.pipeline.upload.invalid.statement-date-required");
  }

  const format = input.format.toLowerCase();
  if (format === "transactions") {
    const relative = transactionsCsvRelative(input.accountType, input.accountId, statementDate);
    return store.readBytes(relative);
  }

  if (format === "txt") {
    const relative = statementTxtRelative(input.accountType, input.accountId, statementDate);
    return store.readBytes(relative);
  }

  if (format !== "pdf" && format !== "csv") {
    throw new Error("statements.pipeline.upload.invalid-format");
  }

  const relative = statementRelativePath(input.accountType, input.accountId, statementDate, format);
  return store.readBytes(relative);
}

export function statementFileExists(
  store: VaultStore,
  input: StatementFileInput,
  userId: string
): boolean {
  const format = input.format.toLowerCase();
  if (format === "zip") {
    const workspaceDir = accountWorkspace(userId, input.accountType, input.accountId);
    return listFiles(workspaceDir).length > 0;
  }

  const statementDate = input.statementDate;
  if (!statementDate) {
    return false;
  }

  if (format === "txt") {
    const relative = statementTxtRelative(input.accountType, input.accountId, statementDate);
    return store.exists(relative);
  }

  return canonicalStatementExists(store, input.accountType, input.accountId, statementDate, format);
}
