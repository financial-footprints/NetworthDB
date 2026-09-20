import type { LedgerApiFilterParams } from "@web/routes/accounts/details/_parts/ledger/query";
import type { LedgerFormState } from "@web/routes/accounts/details/_parts/ledger/TransactionFormFields";
import {
  createTransaction,
  fetchTransactions,
  patchTransaction,
} from "@web/utils/api/routes/transactions";
import type {
  CreateTransactionBody,
  TransactionApi,
} from "@web/utils/api/routes/transactions/types";
import { formatIntegerAsRupee, parseRupeeToInteger } from "@web/utils/money";

export const BULK_TRANSACTION_LIMIT = 5000;
const LIST_FETCH_LIMIT = 10_000;

type TransactionTagApi = TransactionApi["tags"][number];

export function ledgerCategoryCellLabel(row: TransactionApi): string {
  if (row.subcategory) {
    return `${row.category?.name ?? ""} / ${row.subcategory.name}`;
  }
  return row.category?.name ?? "—";
}

export function ledgerAmountDisplay(
  row: TransactionApi,
  accountId: string,
  systemPage: boolean
): string {
  const rupees = `₹${formatIntegerAsRupee(row.amount)}`;
  if (systemPage) {
    return rupees;
  }
  const prefix = row.destination.id === accountId ? "+" : "-";
  return `${prefix}${rupees}`;
}

export function ledgerDialogInitialValues(
  dialog: { mode: "add" } | { mode: "edit"; transaction: TransactionApi } | null,
  accountId: string,
  defaultTxnDate: string,
  unknownId: string
): LedgerFormState {
  if (dialog?.mode === "edit") {
    const row = dialog.transaction;
    return {
      date: row.date,
      amount: formatIntegerAsRupee(row.amount),
      description: row.description,
      ref: row.refNo ?? "",
      sourceAccountId: row.source.id,
      destinationAccountId: row.destination.id,
      categoryId: row.category?.id ?? "",
      subcategoryId: row.subcategory?.id ?? "",
      tagIds: row.tags.map((tag: TransactionTagApi) => tag.id),
    };
  }
  return {
    date: defaultTxnDate,
    amount: "",
    description: "",
    ref: "",
    sourceAccountId: accountId,
    destinationAccountId: unknownId,
    categoryId: "",
    subcategoryId: "",
    tagIds: [],
  };
}

export async function loadMatchingTransactions(
  accountId: string,
  query: LedgerApiFilterParams
): Promise<TransactionApi[]> {
  const items: TransactionApi[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  while (offset < total) {
    const page = await fetchTransactions(accountId, {
      ...query,
      limit: LIST_FETCH_LIMIT,
      offset,
    });
    items.push(...page.items);
    total = page.total;
    offset += page.items.length;
    if (page.items.length === 0) {
      break;
    }
  }
  return items;
}

type LedgerFormValidationResult =
  | { ok: false; messages: string[] }
  | { ok: true; body: CreateTransactionBody };

function parseLedgerAmount(amountInput: string, messages: string[]): number {
  try {
    const amountInteger = parseRupeeToInteger(amountInput);
    if (amountInteger <= 0) {
      messages.push("Enter a valid amount.");
    }
    return amountInteger;
  } catch {
    messages.push("Enter a valid amount.");
    return 0;
  }
}

function validateLedgerAccounts(
  sourceAccountId: string,
  destinationAccountId: string,
  messages: string[]
): void {
  if (!sourceAccountId || !destinationAccountId) {
    messages.push("Source and destination accounts are required.");
    return;
  }
  if (sourceAccountId === destinationAccountId) {
    messages.push("Source and destination must be different accounts.");
  }
}

export function validateLedgerFormForSubmit(form: LedgerFormState): LedgerFormValidationResult {
  const trimmedDescription = form.description.trim();
  const messages: string[] = [];
  if (!trimmedDescription) {
    messages.push("Description is required.");
  }
  const amountInteger = parseLedgerAmount(form.amount, messages);
  validateLedgerAccounts(form.sourceAccountId, form.destinationAccountId, messages);
  if (messages.length > 0) {
    return { ok: false, messages };
  }

  const body: CreateTransactionBody = {
    date: form.date,
    amount: amountInteger,
    sourceAccountId: form.sourceAccountId,
    destinationAccountId: form.destinationAccountId,
    description: trimmedDescription,
    refNo: form.ref.trim() ? form.ref.trim() : null,
    categoryId: form.categoryId || null,
    subcategoryId: form.subcategoryId || null,
    tagIds: form.tagIds,
  };
  return { ok: true, body };
}

export async function persistLedgerTransaction(
  mode: "add" | "edit",
  accountId: string,
  transactionId: string | undefined,
  body: CreateTransactionBody
): Promise<string | null> {
  if (mode === "edit") {
    if (!transactionId) {
      return "Could not save transaction";
    }
    await patchTransaction(accountId, transactionId, body);
    return null;
  }
  await createTransaction(accountId, body);
  return null;
}
