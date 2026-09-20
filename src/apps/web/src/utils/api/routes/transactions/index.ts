import {
  API,
  apiPath,
  balanceSchema,
  bulkDeleteTransactionsSchema,
  bulkUpdateTransactionsSchema,
  rangeSummarySchema,
  systemAccountsSchema,
  transactionListSchema,
  transactionSchema,
} from "@ndb/platform";
import { accountDateToIso } from "@web/utils/active-period";
import { apiRequest } from "@web/utils/api/client";
import { withSessionToken } from "@web/utils/api/routes/auth";
import type {
  BalanceAsOfApi,
  CreateTransactionBody,
  RangeSummaryApi,
  SystemAccountApi,
  TransactionApi,
  UpdateTransactionBody,
} from "@web/utils/api/routes/transactions/types";

export async function fetchTransactions(
  accountId: string,
  params: {
    from?: string;
    to?: string;
    word?: string;
    categoryId?: string;
    subcategoryId?: string;
    tagId?: string;
    sourceAccountId?: string;
    destinationAccountId?: string;
    amountMin?: number;
    amountMax?: number;
    limit?: number;
    offset?: number;
  }
): Promise<{ items: TransactionApi[]; total: number }> {
  return withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.accounts.transactions.list, { accountId }), {
      sessionToken,
      params,
      schema: transactionListSchema,
    })
  );
}

export async function createTransaction(
  accountId: string,
  body: CreateTransactionBody
): Promise<TransactionApi> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.accounts.transactions.create, { accountId }), {
      method: "POST",
      sessionToken,
      body,
      schema: transactionSchema,
    })
  );
  return response.data;
}

export async function fetchTransactionSummary(
  accountId: string,
  params: {
    from?: string;
    to?: string;
    word?: string;
    categoryId?: string;
    subcategoryId?: string;
    tagId?: string;
    sourceAccountId?: string;
    destinationAccountId?: string;
    amountMin?: number;
    amountMax?: number;
  } = {}
): Promise<RangeSummaryApi> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.accounts.transactions.summary, { accountId }), {
      sessionToken,
      params,
      schema: rangeSummarySchema,
    })
  );
  return response.data;
}

export async function fetchBalanceAsOf(accountId: string, on: string): Promise<BalanceAsOfApi> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.accounts.transactions.balance, { accountId }), {
      sessionToken,
      params: { on: accountDateToIso(on) },
      schema: balanceSchema,
    })
  );
  return response.data;
}

export async function bulkUpdateTransactions(
  accountId: string,
  items: Array<UpdateTransactionBody & { id: string }>
): Promise<number> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.accounts.transactions.bulk, { accountId }), {
      method: "POST",
      sessionToken,
      body: { items },
      schema: bulkUpdateTransactionsSchema,
    })
  );
  return response.data.updated;
}

export async function deleteTransaction(accountId: string, transactionId: string): Promise<void> {
  await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.accounts.transactions.delete, { accountId, transactionId }), {
      method: "DELETE",
      sessionToken,
    })
  );
}

export async function bulkDeleteTransactions(accountId: string, ids: string[]): Promise<number> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.accounts.transactions.bulkDelete, { accountId }), {
      method: "POST",
      sessionToken,
      body: { ids },
      schema: bulkDeleteTransactionsSchema,
    })
  );
  return response.data.deleted;
}

export async function patchTransaction(
  accountId: string,
  txnId: string,
  body: UpdateTransactionBody
): Promise<TransactionApi> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.accounts.transactions.patch, { accountId, transactionId: txnId }), {
      method: "PATCH",
      sessionToken,
      body,
      schema: transactionSchema,
    })
  );
  return response.data;
}

export async function fetchSystemAccounts(): Promise<SystemAccountApi[]> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(API.accounts.system.get, { sessionToken, schema: systemAccountsSchema })
  );
  return response.data.items;
}
