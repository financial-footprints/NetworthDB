import { basename } from "node:path";
import type { Account } from "@ndb/core";
import { statementRelativePath } from "@statements/storage/vault/path";
import type { VaultStore } from "@statements/storage/vault/store";

export function sweepOrphans(
  store: VaultStore,
  account: Account,
  financialYear?: string | null
): number {
  let removed = 0;

  const prefix = financialYear
    ? `${financialYear}/${account.accountType}/${account.id}/`
    : undefined;
  for (const key of store.list(prefix)) {
    if (!key.endsWith(".txt") || key.includes("transactions-")) {
      continue;
    }
    const stem = basename(key, ".txt");
    const pdfRelative = statementRelativePath(account.accountType, account.id, stem, "pdf");
    if (store.exists(pdfRelative)) {
      continue;
    }
    store.unlink(key);
    removed += 1;
  }

  return removed;
}
