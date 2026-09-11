import { API } from "@ndb/platform";
import { readRefreshToken, writeRefreshToken } from "@web/context/Auth/storage";
import { del, get, patch, post, put } from "@web/utils/api/client";
import { parseLoginResponse } from "@web/utils/api/endpoints/auth/http";
import {
  clearSessionTokenCache,
  readCachedSessionToken,
  writeSessionTokenCache,
} from "@web/utils/api/endpoints/auth/sessionTokens";
import type {
  ListUsersParams,
  ListUsersResponse,
  LoginResult,
  MeResponse,
  PatchMePayload,
  RecoveryEmailPayload,
  RegisterUserPayload,
  RegisterUserResponse,
  TokenPair,
  VaultInitializePayload,
  VaultSlot,
  VaultSlotPayload,
} from "@web/utils/api/endpoints/auth/types";
import { apiPath } from "@web/utils/api/path";
import { ApiError } from "@web/utils/api/types";

export {
  collectWebAuthnMfaProof,
  deleteWebAuthnCredential,
  listWebAuthnCredentials,
  mfaVerify,
  parseOtpauthSecret,
  recoveryClear,
  recoveryGenerate,
  totpBegin,
  totpConfirm,
  totpDisable,
  webauthnLoginBegin,
  webauthnLoginFinish,
  webauthnRegisterBegin,
  webauthnRegisterFinish,
} from "@web/utils/api/endpoints/auth/mfa";

export {
  clearSessionTokenCache,
  readCachedSessionToken,
  writeSessionTokenCache,
} from "@web/utils/api/endpoints/auth/sessionTokens";

let refreshInFlight: Promise<TokenPair> | null = null;

export function applyTokenPair(tokens: TokenPair): void {
  writeRefreshToken(tokens.refresh_token);
  writeSessionTokenCache(tokens);
}

export async function refreshSessionToken(): Promise<TokenPair> {
  const refreshToken = readRefreshToken();
  if (!refreshToken) {
    throw new Error("not authenticated");
  }

  if (!refreshInFlight) {
    refreshInFlight = refresh(refreshToken)
      .then((tokens) => {
        applyTokenPair(tokens);
        return tokens;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

export async function getSessionToken(): Promise<string> {
  const cached = readCachedSessionToken();
  if (cached) {
    return cached;
  }
  const tokens = await refreshSessionToken();
  return tokens.session_token;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const normalizedUsername = username.trim().toLowerCase();
  const { data } = await post<unknown>(API.auth.session.login, {
    username: normalizedUsername,
    password,
  });
  return parseLoginResponse(data);
}

async function refresh(refreshToken: string): Promise<TokenPair> {
  const { data } = await post<TokenPair>(API.auth.session.refresh, {
    refresh_token: refreshToken,
  });
  return data;
}

export async function logout(): Promise<void> {
  await withSessionToken(async (sessionToken) => {
    await post(API.auth.session.logout, undefined, { sessionToken: sessionToken });
  });
  clearSessionTokenCache();
}

export async function getMe(sessionToken: string): Promise<MeResponse> {
  const { data } = await get<MeResponse>(API.users.me.details, {
    sessionToken: sessionToken,
  });
  return data;
}

export async function withSessionToken<T>(fn: (sessionToken: string) => Promise<T>): Promise<T> {
  const sessionToken = await getSessionToken();
  try {
    return await fn(sessionToken);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearSessionTokenCache();
      const retryToken = await getSessionToken();
      return fn(retryToken);
    }
    throw error;
  }
}

function buildListUsersQuery(params: ListUsersParams = {}): string {
  const searchParams = new URLSearchParams();
  if (params.pagination?.limit !== undefined) {
    searchParams.set("pagination.limit", String(params.pagination.limit));
  }
  if (params.pagination?.offset !== undefined) {
    searchParams.set("pagination.offset", String(params.pagination.offset));
  }
  if (params.filters?.multifactor_enabled !== undefined) {
    searchParams.set(
      "filters.multifactor_enabled",
      params.filters.multifactor_enabled ? "true" : "false"
    );
  }
  if (params.filters?.role !== undefined && params.filters.role !== "") {
    searchParams.set("filters.role", params.filters.role);
  }
  if (params.search !== undefined && params.search !== "") {
    searchParams.set("search", params.search);
  }
  return searchParams.toString();
}

export async function listUsers(params: ListUsersParams = {}): Promise<ListUsersResponse> {
  return withSessionToken(async (sessionToken) => {
    const query = buildListUsersQuery(params);
    const path = query ? `${API.users.list}?${query}` : API.users.list;
    const { data } = await get<ListUsersResponse>(path, { sessionToken: sessionToken });
    return data;
  });
}

export async function registerUser(payload: RegisterUserPayload): Promise<RegisterUserResponse> {
  return withSessionToken(async (sessionToken) => {
    const { data } = await post<RegisterUserResponse>(API.users.create, payload, {
      sessionToken: sessionToken,
    });
    return data;
  });
}

export async function deleteUser(id: string): Promise<void> {
  return withSessionToken(async (sessionToken) => {
    await del(apiPath(API.users.details, { id }), { sessionToken: sessionToken });
  });
}

function isTokenPair(value: unknown): value is TokenPair {
  return (
    typeof value === "object" &&
    value !== null &&
    "session_token" in value &&
    typeof (value as TokenPair).session_token === "string"
  );
}

export async function initializeVault(
  sessionToken: string,
  payload: VaultInitializePayload
): Promise<VaultSlot[]> {
  const { data } = await post<{ vault_slots: VaultSlot[] }>(
    API.users.me.vault.initialize,
    payload,
    { sessionToken: sessionToken }
  );
  return data.vault_slots;
}

export async function createVaultSlot(
  sessionToken: string,
  payload: VaultSlotPayload
): Promise<VaultSlot> {
  const { data } = await post<VaultSlot>(API.users.me.vault.slots.list, payload, {
    sessionToken: sessionToken,
  });
  return data;
}

export async function updateVaultSlot(
  sessionToken: string,
  slotID: string,
  payload: Pick<VaultSlotPayload, "salt" | "wrap_blob" | "password">
): Promise<VaultSlot> {
  const { data } = await put<VaultSlot>(
    apiPath(API.users.me.vault.slots.details, { id: slotID }),
    payload,
    { sessionToken: sessionToken }
  );
  return data;
}

export async function deleteVaultSlot(
  sessionToken: string,
  slotID: string,
  payload?: { password?: string }
): Promise<void> {
  await del(apiPath(API.users.me.vault.slots.details, { id: slotID }), {
    sessionToken: sessionToken,
    body: payload,
  });
}

export async function patchMeWithToken(
  sessionToken: string,
  payload: PatchMePayload
): Promise<TokenPair | null> {
  const { data } = await patch<TokenPair | null>(API.users.me.update, payload, {
    sessionToken: sessionToken,
  });
  if (isTokenPair(data)) {
    applyTokenPair(data);
    return data;
  }
  return null;
}

export async function setRecoveryEmail(payload: RecoveryEmailPayload): Promise<MeResponse> {
  return withSessionToken(async (sessionToken) => {
    await patchMeWithToken(sessionToken, {
      recovery_email: payload.recovery_email,
      current_password: payload.current_password,
    });
    return getMe(sessionToken);
  });
}

export async function clearRecoveryEmail(payload: {
  current_password: string;
}): Promise<MeResponse> {
  return withSessionToken(async (sessionToken) => {
    await patchMeWithToken(sessionToken, {
      recovery_email: null,
      current_password: payload.current_password,
    });
    return getMe(sessionToken);
  });
}
