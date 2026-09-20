import type { BackupTransactionRow } from "@core/domains/account/backup/backup-archive-rows";
import { parseTransactionRow } from "@core/domains/account/backup/backup-archive-rows";
import { TRANSACTIONS_JSONL_NAME } from "@core/domains/account/backup/constants";
import type { Account } from "@core/domains/account/entities/account";
import { Transaction } from "@core/domains/account/transactions/entities/transaction";
import { assertAllowedTransactionPair } from "@core/domains/account/transactions/helpers";
import { JobExecutionError } from "@core/domains/jobs/embedded/output";

export type BackupTransactionIdMaps = {
  accountIdMap: Map<string, string>;
  categoryIdMap: Map<string, string>;
  tagIdMap: Map<string, string>;
  importIdMap: Map<string, string>;
};

export type MappedBackupTransaction = {
  txn: Transaction;
  sourceId: string;
  destId: string;
  date: string;
};

export async function collectBackupTransactionRows(
  files: { readJsonl(name: string): AsyncIterable<unknown> },
  shouldCancel: () => boolean
): Promise<BackupTransactionRow[]> {
  const pending: BackupTransactionRow[] = [];
  for await (const raw of files.readJsonl(TRANSACTIONS_JSONL_NAME)) {
    if (shouldCancel()) {
      throw new JobExecutionError("Backup import was cancelled.");
    }
    if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) {
      continue;
    }
    pending.push(parseTransactionRow(raw));
  }
  return pending;
}

export function mapBackupTransactionForImport(
  row: BackupTransactionRow,
  userId: string,
  ownerUserId: string | undefined,
  maps: BackupTransactionIdMaps,
  accountMap: Map<string, Account>
): MappedBackupTransaction | null {
  const sourceId = maps.accountIdMap.get(row.source_account_id);
  const destId = maps.accountIdMap.get(row.destination_account_id);
  if (!sourceId || !destId) {
    return null;
  }
  if (ownerUserId === userId) {
    return null;
  }
  const source = accountMap.get(sourceId);
  const dest = accountMap.get(destId);
  if (!source || !dest) {
    return null;
  }
  try {
    assertAllowedTransactionPair(source, dest);
  } catch {
    return null;
  }

  const txnId = ownerUserId && ownerUserId !== userId ? crypto.randomUUID() : row.id;
  const importId = row.import_id === null ? null : (maps.importIdMap.get(row.import_id) ?? null);
  const categoryId =
    row.category_id === null ? null : (maps.categoryIdMap.get(row.category_id) ?? null);
  const subcategoryId =
    row.subcategory_id === null ? null : (maps.categoryIdMap.get(row.subcategory_id) ?? null);
  const tagIds = row.tag_ids
    .map((id) => maps.tagIdMap.get(id))
    .filter((id): id is string => id !== undefined);

  const txn = Transaction.create({
    id: txnId,
    userId,
    date: row.date,
    amount: row.amount,
    sourceAccountId: sourceId,
    destinationAccountId: destId,
    description: row.description,
    refNo: row.ref_no,
    importId,
    categoryId,
    subcategoryId,
    tagIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  return { txn, sourceId, destId, date: row.date };
}
