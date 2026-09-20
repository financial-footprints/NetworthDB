import type {
  Account,
  Category,
  RangeSummary,
  Tag,
  Transaction,
  TransactionImport,
} from "@ndb/core";
import { isSystemAccountType, SYSTEM_ACCOUNT_LABELS } from "@ndb/core";
import {
  balanceSchema,
  formatInstrumentAccountPickerLabel,
  nullableDetailsResponseSchema,
  rangeSummarySchema,
  transactionImportSchema,
  transactionListSchema,
  transactionSchema,
} from "@ndb/platform";
import { z } from "zod";

export const nullableTransactionResponseSchema = nullableDetailsResponseSchema(z.null());

function partyPayload(account: Account, catalogTitles: ReadonlyMap<string, string>) {
  const label = isSystemAccountType(account.accountType)
    ? SYSTEM_ACCOUNT_LABELS[account.accountType]
    : formatInstrumentAccountPickerLabel(account, catalogTitles);
  return {
    id: account.id,
    label,
    accountType: account.accountType,
  };
}

function taxonomyRef(
  id: string | null,
  map: Map<string, Category | Tag>
): { id: string; name: string } | null {
  if (!id) {
    return null;
  }
  const row = map.get(id);
  if (!row) {
    throw new Error("api.transactions.serialize.missing-taxonomy");
  }
  return { id: row.id, name: row.name };
}

function serializeTransactionData(
  txn: Transaction,
  accountsById: Map<string, Account>,
  categoriesById: Map<string, Category>,
  tagsById: Map<string, Tag>,
  catalogTitles: ReadonlyMap<string, string>
) {
  const source = accountsById.get(txn.sourceAccountId);
  const destination = accountsById.get(txn.destinationAccountId);
  if (!source || !destination) {
    throw new Error("api.transactions.serialize.missing-account");
  }
  const tags = txn.tagIds.map((tagId) => {
    const tag = tagsById.get(tagId);
    if (!tag) {
      throw new Error("api.transactions.serialize.missing-taxonomy");
    }
    return { id: tag.id, name: tag.name };
  });
  return {
    id: txn.id,
    date: txn.date,
    amount: txn.amount,
    source: partyPayload(source, catalogTitles),
    destination: partyPayload(destination, catalogTitles),
    description: txn.description,
    refNo: txn.refNo,
    importId: txn.importId,
    category: taxonomyRef(txn.categoryId, categoriesById),
    subcategory: taxonomyRef(txn.subcategoryId, categoriesById),
    tags,
    createdAt: txn.createdAt,
    updatedAt: txn.updatedAt,
  };
}

export function serializeTransaction(
  txn: Transaction,
  accountsById: Map<string, Account>,
  categoriesById: Map<string, Category>,
  tagsById: Map<string, Tag>,
  catalogTitles: ReadonlyMap<string, string> = new Map()
) {
  return transactionSchema.parse({
    data: serializeTransactionData(txn, accountsById, categoriesById, tagsById, catalogTitles),
  });
}

export function serializeTransactionList(
  items: Transaction[],
  total: number,
  accountsById: Map<string, Account>,
  categoriesById: Map<string, Category>,
  tagsById: Map<string, Tag>,
  catalogTitles: ReadonlyMap<string, string> = new Map()
) {
  return transactionListSchema.parse({
    items: items.map((txn) =>
      serializeTransactionData(txn, accountsById, categoriesById, tagsById, catalogTitles)
    ),
    total,
  });
}

export function serializeImport(row: TransactionImport) {
  return transactionImportSchema.parse({
    data: {
      id: row.id,
      accountId: row.accountId,
      createdAt: row.createdAt,
    },
  });
}

export function serializeRangeSummary(summary: RangeSummary) {
  return rangeSummarySchema.parse({
    data: {
      from: summary.from,
      to: summary.to,
      opening: summary.opening,
      closing: summary.closing,
      amountCredit: summary.amountCredit,
      amountDebit: summary.amountDebit,
      txnCount: summary.txnCount,
    },
  });
}

export function serializeNullableTransactionResponse() {
  return nullableTransactionResponseSchema.parse({ data: null });
}

export function serializeBalance(on: string, balance: number) {
  return balanceSchema.parse({ data: { on, balance } });
}
