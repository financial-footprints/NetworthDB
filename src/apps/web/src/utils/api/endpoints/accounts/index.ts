import { API } from "@ndb/platform";
import { formToAccountBody } from "@web/utils/accounts";
import { buildUrl, del, get, patch, post } from "@web/utils/api/client";
import type {
  Account,
  AccountApi,
  AccountDetails,
  AccountDetailsApi,
  AccountDetailsParams,
  AccountFileParams,
  AccountListResponse,
  AccountType,
  AccountUpdatePayload,
  AccountWritePayload,
  BankListResponse,
  StatementUploadParams,
} from "@web/utils/api/endpoints/accounts/types";
import { withSessionToken } from "@web/utils/api/endpoints/auth";
import type { JobCreatedResponse } from "@web/utils/api/endpoints/jobs/types";
import { applyRequestAuthHeaders, createVersionedResource } from "@web/utils/api/helpers";
import { apiPath } from "@web/utils/api/path";
import { withVaultDek } from "@web/utils/api/syncAuth";
import type { ListData } from "@web/utils/api/types";
import { openField } from "@web/utils/crypto/vault";
import { errorMessage } from "@web/utils/errors";
import { normalizeAccountDateInput } from "@web/utils/time";

const detailsCache = new Map<string, Promise<AccountDetails>>();
let banksCache: Promise<BankListResponse> | null = null;

async function openAccount(dek: CryptoKey, account: AccountApi): Promise<Account> {
  let account_number: string;
  try {
    account_number = await openField(dek, account.account_number);
  } catch (error) {
    throw new Error(
      `Failed to decrypt account ${account.id} (${account.bank}): ${errorMessage(error, "decryption failed")}`
    );
  }
  const { account_number: _, ...rest } = account;
  return { ...rest, account_number };
}

async function openAccountDetails(
  dek: CryptoKey,
  details: AccountDetailsApi
): Promise<AccountDetails> {
  const account = await openAccount(dek, details.account);
  return { ...details, account };
}

function authHeaders(sessionToken: string): Record<string, string> {
  const headers = new Headers();
  applyRequestAuthHeaders(headers, { sessionToken: sessionToken });
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

function loadAccounts(accountType: AccountType): Promise<AccountListResponse> {
  return withVaultDek(async (sessionToken, dek) => {
    const response = await get<ListData<AccountApi>>(API.accounts.list, {
      sessionToken: sessionToken,
      params: { account_type: accountType },
    });
    const items = response.data?.items ?? [];
    const accounts = await Promise.all(items.map((item) => openAccount(dek, item)));
    return { accounts };
  });
}

const accountLists = {
  credit_card: createVersionedResource(() => loadAccounts("credit_card")),
  bank_account: createVersionedResource(() => loadAccounts("bank_account")),
} as const;

function accountListResource(accountType: AccountType) {
  return accountLists[accountType];
}

function accountDetailsKey(params: AccountDetailsParams): string {
  return params.accountId;
}

function loadAccountDetails(params: AccountDetailsParams): Promise<AccountDetails> {
  return withVaultDek(async (sessionToken, dek) => {
    const response = await get<AccountDetailsApi>(
      apiPath(API.accounts.metadata, { id: params.accountId }),
      { sessionToken: sessionToken }
    );
    if (!response.data) {
      throw new Error("Account details response was empty.");
    }
    return openAccountDetails(dek, response.data);
  });
}

export function readAccounts(accountType: AccountType): Promise<AccountListResponse> {
  return accountListResource(accountType).read();
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

export function invalidateAccounts(accountType: AccountType): void {
  accountListResource(accountType).invalidate();
}

export function invalidateAccountDetails(params: AccountDetailsParams): void {
  detailsCache.delete(accountDetailsKey(params));
}

export function invalidateAllAccountCaches(): void {
  accountLists.credit_card.invalidate();
  accountLists.bank_account.invalidate();
  detailsCache.clear();
}

export function useAccounts(accountType: AccountType): AccountListResponse {
  return accountListResource(accountType).useResource();
}

export function readBanks(): Promise<BankListResponse> {
  if (!banksCache) {
    banksCache = withSessionToken((sessionToken) =>
      get<BankListResponse>(API.accounts.banks, { sessionToken: sessionToken }).then(
        (response) => response.data
      )
    );
  }
  return banksCache;
}

function accountFileUrl(params: AccountFileParams): string {
  return buildUrl(apiPath(API.accounts.files.download, { id: params.accountId }), {
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
    post<JobCreatedResponse>(API.accounts.files.upload, formData, {
      sessionToken: sessionToken,
    }).then((response) => response.data)
  );
}

export function getAccountForEdit(accountId: string): Promise<Account> {
  return withVaultDek(async (sessionToken, dek) => {
    const response = await get<AccountApi>(apiPath(API.accounts.details, { id: accountId }), {
      sessionToken: sessionToken,
    });
    if (!response.data) {
      throw new Error("Account response was empty.");
    }
    return openAccount(dek, response.data);
  });
}

export function createAccount(payload: AccountWritePayload): Promise<Account> {
  return withVaultDek(async (sessionToken, dek) => {
    const body = await formToAccountBody(dek, payload);
    const response = await post<AccountApi>(API.accounts.create, body, {
      sessionToken: sessionToken,
    });
    if (!response.data) {
      throw new Error("Create account response was empty.");
    }
    invalidateAllAccountCaches();
    return openAccount(dek, response.data);
  });
}

export function updateAccount(accountId: string, payload: AccountUpdatePayload): Promise<Account> {
  return withVaultDek(async (sessionToken, dek) => {
    const body = await formToAccountBody(dek, payload);
    const response = await patch<AccountApi>(
      apiPath(API.accounts.details, { id: accountId }),
      body,
      { sessionToken: sessionToken }
    );
    if (!response.data) {
      throw new Error("Update account response was empty.");
    }
    invalidateAllAccountCaches();
    return openAccount(dek, response.data);
  });
}

export async function deleteAccount(accountId: string, accountType: AccountType): Promise<void> {
  await withSessionToken(async (sessionToken) => {
    await del(apiPath(API.accounts.details, { id: accountId }), {
      sessionToken: sessionToken,
    });
    invalidateAccounts(accountType);
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
    account_number: account.account_number,
    passwords: account.passwords ?? [],
    opening_date: normalizeAccountDateInput(account.opening_date),
    closing_date: account.closing_date ? normalizeAccountDateInput(account.closing_date) : null,
    statement: account.statement_rules ?? { text_contains: [], text_not_contains: [] },
    mail: account.mail_rules ?? { subjects: [], body_contains: [], from: [] },
    type: accountType,
  };
}
