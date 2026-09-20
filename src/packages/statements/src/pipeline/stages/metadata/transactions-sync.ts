import { type Account, EntityNotFoundError } from "@ndb/core";
import type {
  StatementMetadata,
  StoredAccountMetadata,
} from "@statements/pipeline/stages/metadata/stored";
import { readStoredMetadata } from "@statements/storage/read/metadata";
import { accountMetadataRelative } from "@statements/storage/vault/path";
import type { VaultStore } from "@statements/storage/vault/store";

function writeMetadata(store: VaultStore, account: Account, metadata: StoredAccountMetadata): void {
  const relative = accountMetadataRelative(account.accountType, account.id);
  store.writeBytes(relative, Buffer.from(JSON.stringify(metadata, null, 2)));
}

function defaultSyncFields(statement: StatementMetadata): StatementMetadata {
  return {
    ...statement,
    transactions_synced: statement.transactions_synced ?? false,
    transactions_import_id: statement.transactions_import_id ?? null,
  };
}

export function mergePreservedTransactionsSync(
  metadata: StoredAccountMetadata,
  previous: StoredAccountMetadata | null
): StoredAccountMetadata {
  if (!previous || !Array.isArray(previous.statements)) {
    return {
      ...metadata,
      statements: metadata.statements.map(defaultSyncFields),
    };
  }

  const byDate = new Map(previous.statements.map((row) => [row.statement_date, row]));
  return {
    ...metadata,
    statements: metadata.statements.map((statement) => {
      const prior = byDate.get(statement.statement_date);
      return defaultSyncFields({
        ...statement,
        transactions_synced: prior?.transactions_synced ?? false,
        transactions_import_id: prior?.transactions_import_id ?? null,
      });
    }),
  };
}

export function forceTransactionsUnsynced(
  metadata: StoredAccountMetadata,
  periods: readonly string[]
): StoredAccountMetadata {
  if (periods.length === 0 || !Array.isArray(metadata.statements)) {
    return metadata;
  }

  const periodSet = new Set(periods);
  return {
    ...metadata,
    statements: metadata.statements.map((statement) => {
      if (!periodSet.has(statement.statement_date)) {
        return defaultSyncFields(statement);
      }
      return {
        ...statement,
        transactions_synced: false,
        transactions_import_id: statement.transactions_import_id ?? null,
      };
    }),
  };
}

export function markTransactionsUnsyncedForPeriods(
  store: VaultStore,
  account: Account,
  periods: string[]
): void {
  const metadata = readStoredMetadata(store, account);
  if (!metadata || !Array.isArray(metadata.statements)) {
    return;
  }

  const periodSet = new Set(periods);
  const statements = metadata.statements.map((statement) => {
    if (!periodSet.has(statement.statement_date)) {
      return defaultSyncFields(statement);
    }
    return {
      ...statement,
      transactions_synced: false,
      transactions_import_id: statement.transactions_import_id ?? null,
    };
  });

  writeMetadata(store, account, { ...metadata, statements });
}

export function setTransactionsSyncForPeriod(
  store: VaultStore,
  account: Account,
  period: string,
  transactionsSynced: boolean,
  transactionsImportId: string | null
): void {
  const metadata = readStoredMetadata(store, account);
  if (!metadata || !Array.isArray(metadata.statements)) {
    throw new EntityNotFoundError("StatementMetadata", account.id);
  }

  let found = false;
  const statements = metadata.statements.map((statement) => {
    if (statement.statement_date !== period) {
      return defaultSyncFields(statement);
    }
    found = true;
    return {
      ...statement,
      transactions_synced: transactionsSynced,
      transactions_import_id: transactionsImportId,
    };
  });

  if (!found) {
    throw new EntityNotFoundError("StatementPeriod", period, { accountId: account.id });
  }

  writeMetadata(store, account, { ...metadata, statements });
}
