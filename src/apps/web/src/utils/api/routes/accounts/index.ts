import {
  API,
  accountDetailsSchema,
  accountListSchema,
  accountSchema,
  apiPath,
  bankListSchema,
  jobCreatedSchema,
} from "@ndb/platform";
import { formToAccountBody } from "@web/utils/accounts";
import { apiRequest, buildUrl } from "@web/utils/api/client";
import {
  applyRequestAuthHeaders,
  createVersionedResource,
  VAULT_LOCKED_MESSAGE,
  withVaultDek,
} from "@web/utils/api/helpers";
import {
  invalidateAllAccountCaches,
  registerAccountCacheHandlers,
} from "@web/utils/api/routes/accounts/cache";
import type {
  Account,
  AccountApi,
  AccountDetails,
  AccountDetailsApi,
  AccountDetailsParams,
  AccountFileParams,
  AccountListQuery,
  AccountListResponse,
  AccountType,
  AccountUpdatePayload,
  AccountWritePayload,
  BankListResponse,
  StatementUploadParams,
} from "@web/utils/api/routes/accounts/types";
import { fetchMe, withSessionToken } from "@web/utils/api/routes/auth";
import type { JobCreatedResponse } from "@web/utils/api/routes/jobs/types";
import { fetchBalanceAsOf } from "@web/utils/api/routes/transactions";
import { isE2eeEnabled, parseClientSettings } from "@web/utils/crypto/client-settings";
import { readDEK } from "@web/utils/crypto/session";
import { openField } from "@web/utils/crypto/vault";
import { errorMessage } from "@web/utils/errors";
import { normalizeAccountDateInput } from "@web/utils/time";
import { useEffect, useRef } from "react";

const detailsCache = new Map<string, Promise<AccountDetails>>();
const balanceCache = new Map<string, Promise<{ on: string; balance: number }>>();
let banksCache: Promise<BankListResponse> | null = null;

async function openAccount(dek: CryptoKey | null, account: AccountApi): Promise<Account> {
  let accountNumber: string;
  if (dek) {
    try {
      accountNumber = await openField(dek, account.accountNumber);
    } catch (error) {
      throw new Error(
        `Failed to decrypt account ${account.id} (${account.bank}): ${errorMessage(error, "decryption failed")}`
      );
    }
  } else {
    accountNumber = account.accountNumber;
  }
  return {
    ...account,
    accountNumber,
    currentBalance:
      "currentBalance" in account && typeof account.currentBalance === "number"
        ? account.currentBalance
        : 0,
  };
}

async function openAccountDetails(
  dek: CryptoKey | null,
  details: AccountDetailsApi
): Promise<AccountDetails> {
  const account = await openAccount(dek, details.account);
  return { ...details, account };
}

function authHeaders(sessionToken: string): Record<string, string> {
  const headers = new Headers();
  applyRequestAuthHeaders(headers, { sessionToken });
  headers.set("X-Request-Id", crypto.randomUUID());
  return Object.fromEntries(headers.entries());
}

async function fetchBlob(url: string, sessionToken: string, errorLabel: string): Promise<Blob> {
  const response = await fetch(url, { headers: authHeaders(sessionToken) });
  if (!response.ok) {
    throw new Error(`${errorLabel} (${response.status})`);
  }
  return response.blob();
}

function accountListParams(query?: AccountListQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (query?.account_type) {
    params.accountType = query.account_type;
  }
  if (query?.status) {
    params.status = query.status;
  }
  if (query?.q) {
    params.q = query.q;
  }
  if (query?.sort) {
    params.sort = query.sort;
  }
  if (query?.direction) {
    params.direction = query.direction;
  }
  return params;
}

function accountListCacheKey(query?: AccountListQuery): string {
  return JSON.stringify(accountListParams(query));
}

function loadAccounts(query?: AccountListQuery): Promise<AccountListResponse> {
  return withVaultDek(async (sessionToken, dek) => {
    const response = await apiRequest(API.accounts.list, {
      sessionToken,
      params: accountListParams(query),
      schema: accountListSchema,
    });
    const items = response.items ?? [];
    const accounts = await Promise.all(items.map((item) => openAccount(dek, item)));
    return { accounts };
  });
}

async function accountNumberEncryptionEnabled(sessionToken: string): Promise<boolean> {
  const me = await fetchMe(sessionToken);
  return isE2eeEnabled(parseClientSettings(me.clientSettings ?? null), "account_number");
}

async function dekForAccountWrite(encrypt: boolean): Promise<CryptoKey | null> {
  if (!encrypt) {
    return null;
  }
  const dek = await readDEK();
  if (!dek) {
    throw new Error(VAULT_LOCKED_MESSAGE);
  }
  return dek;
}

const accountListQueryHolder: { current: AccountListQuery | undefined } = {
  current: undefined,
};

const accountListResource = createVersionedResource(() =>
  loadAccounts(accountListQueryHolder.current)
);

function invalidateAllAccountListResources(): void {
  accountListResource.invalidate();
}

function accountDetailsKey(params: AccountDetailsParams): string {
  return params.accountId;
}

function loadAccountDetails(params: AccountDetailsParams): Promise<AccountDetails> {
  return withVaultDek(async (sessionToken, dek) => {
    const response = await apiRequest(
      apiPath(API.accounts.metadata.get, { accountId: params.accountId }),
      {
        sessionToken,
        schema: accountDetailsSchema,
      }
    );
    return openAccountDetails(dek, response.data);
  });
}

export function readAccounts(query?: AccountListQuery): Promise<AccountListResponse> {
  accountListQueryHolder.current = query;
  return accountListResource.read();
}

export function readAccountDetails(params: AccountDetailsParams): Promise<AccountDetails> {
  const key = accountDetailsKey(params);
  let promise = detailsCache.get(key);
  if (!promise) {
    promise = loadAccountDetails(params);
    detailsCache.set(key, promise);
  }
  return promise;
}

function accountBalanceKey(accountId: string, on: string): string {
  return `${accountId}:${on}`;
}

export function readAccountBalance(
  accountId: string,
  on: string
): Promise<{ on: string; balance: number }> {
  const key = accountBalanceKey(accountId, on);
  let promise = balanceCache.get(key);
  if (!promise) {
    promise = fetchBalanceAsOf(accountId, on);
    balanceCache.set(key, promise);
  }
  return promise;
}

function clearBalanceCacheForAccount(accountId: string): void {
  for (const key of balanceCache.keys()) {
    if (key.startsWith(`${accountId}:`)) {
      balanceCache.delete(key);
    }
  }
}

export function invalidateAccountDetails(params: AccountDetailsParams): void {
  detailsCache.delete(accountDetailsKey(params));
  clearBalanceCacheForAccount(params.accountId);
  invalidateAllAccountListResources();
}

export { invalidateAllAccountCaches } from "@web/utils/api/routes/accounts/cache";

registerAccountCacheHandlers({
  invalidateAllLists: invalidateAllAccountListResources,
  clearDetailsCache: () => {
    detailsCache.clear();
    balanceCache.clear();
  },
});

export function useAccounts(query?: AccountListQuery): AccountListResponse {
  const key = accountListCacheKey(query);
  const prevKeyRef = useRef<string | undefined>(undefined);
  accountListQueryHolder.current = query;

  useEffect(() => {
    if (prevKeyRef.current === undefined) {
      prevKeyRef.current = key;
      return;
    }
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key;
      accountListResource.invalidate();
    }
  }, [key]);

  return accountListResource.useResource();
}

export function readBanks(): Promise<BankListResponse> {
  let cache = banksCache;
  if (!cache) {
    cache = withSessionToken((sessionToken) =>
      apiRequest(API.accounts.banks.get, { sessionToken, schema: bankListSchema })
    );
    banksCache = cache;
  }
  return cache;
}

function accountFileUrl(params: AccountFileParams): string {
  return buildUrl(apiPath(API.accounts.files.download, { accountId: params.accountId }), {
    statement_date: params.statementDate,
    format: params.format,
  });
}

export async function fetchAccountFileBlob(params: AccountFileParams): Promise<Blob> {
  return withSessionToken((sessionToken) =>
    fetchBlob(accountFileUrl(params), sessionToken, "failed to fetch statement file")
  );
}

export function uploadStatementFile(params: StatementUploadParams): Promise<JobCreatedResponse> {
  const formData = new FormData();
  formData.append("account_id", params.accountId);
  formData.append("format", params.format);
  formData.append("file", params.file, params.file.name);
  if (params.format !== "zip") {
    formData.append("statement_kind", params.statementKind ?? "monthly");
    if (params.coveredMonth) {
      formData.append("covered_month", params.coveredMonth);
    }
    if (params.yearKey) {
      formData.append("year_key", params.yearKey);
    }
  }

  return withSessionToken((sessionToken) =>
    apiRequest(API.accounts.files.upload, {
      method: "POST",
      sessionToken,
      body: formData,
      schema: jobCreatedSchema,
    }).then((response) => response.data)
  );
}

export function createAccount(payload: AccountWritePayload): Promise<Account> {
  return withSessionToken(async (sessionToken) => {
    const encrypt = await accountNumberEncryptionEnabled(sessionToken);
    const dek = await dekForAccountWrite(encrypt);
    const body = await formToAccountBody(dek, payload, encrypt);
    const response = await apiRequest(API.accounts.create, {
      method: "POST",
      sessionToken,
      body,
      schema: accountSchema,
    });
    invalidateAllAccountCaches();
    return openAccount(dek, response.data);
  });
}

export function updateAccount(accountId: string, payload: AccountUpdatePayload): Promise<Account> {
  return withSessionToken(async (sessionToken) => {
    const encrypt = await accountNumberEncryptionEnabled(sessionToken);
    const dek = await dekForAccountWrite(encrypt);
    const body = await formToAccountBody(dek, payload, encrypt);
    const response = await apiRequest(apiPath(API.accounts.patch, { accountId: accountId }), {
      method: "PATCH",
      sessionToken,
      body,
      schema: accountSchema,
    });
    invalidateAllAccountCaches();
    return openAccount(dek, response.data);
  });
}

export async function deleteAccount(accountId: string): Promise<void> {
  await withSessionToken(async (sessionToken) => {
    await apiRequest(apiPath(API.accounts.delete, { accountId: accountId }), {
      method: "DELETE",
      sessionToken,
    });
    invalidateAllAccountCaches();
    invalidateAccountDetails({ accountId });
  });
}

export function accountToFormPayload(
  account: Account,
  accountType: AccountType
): AccountWritePayload {
  return {
    bank: account.bank,
    variant: account.variant,
    account_number: account.accountNumber,
    passwords: account.passwords ?? [],
    opening_date: normalizeAccountDateInput(account.openingDate),
    closing_date: account.closingDate ? normalizeAccountDateInput(account.closingDate) : null,
    statement: account.statement
      ? {
          text_contains: account.statement.textContains,
          text_not_contains: account.statement.textNotContains,
        }
      : { text_contains: [], text_not_contains: [] },
    mail: account.mail
      ? {
          subjects: account.mail.subjects,
          body_contains: account.mail.bodyContains,
          from: account.mail.fromAddresses,
        }
      : { subjects: [], body_contains: [], from: [] },
    type: accountType,
  };
}
