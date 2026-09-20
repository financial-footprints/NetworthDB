import {
  API,
  apiPath,
  loginSchema,
  meDetailsSchema,
  parseLoginResponse,
  patchMeSchema,
  sessionTokenSchema,
  userListSchema,
  userSchema,
  vaultSlotSchema,
  vaultSlotsSchema,
} from "@ndb/platform";
import { readRefreshToken, writeRefreshToken } from "@web/contexts/Auth/storage";
import { apiRequest } from "@web/utils/api/client";
import {
  clearSessionTokenCache,
  readCachedSessionToken,
  writeSessionTokenCache,
} from "@web/utils/api/routes/auth/tokens";
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
} from "@web/utils/api/routes/auth/types";
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
} from "@web/utils/api/routes/auth/mfa";

export {
  clearSessionTokenCache,
  writeSessionTokenCache,
} from "@web/utils/api/routes/auth/tokens";

let refreshInFlight: Promise<TokenPair> | null = null;

/** Clears in-memory session token cache and any in-flight refresh (for tests). */
export function resetAuthSessionState(): void {
  refreshInFlight = null;
  clearSessionTokenCache();
}

export function applyTokenPair(tokens: TokenPair): void {
  writeRefreshToken(tokens.refreshToken);
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
  return tokens.sessionToken;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const normalizedUsername = username.trim().toLowerCase();
  const envelope = await apiRequest(API.auth.session.login, {
    method: "POST",
    body: { username: normalizedUsername, password },
    schema: loginSchema,
  });
  return parseLoginResponse(envelope);
}

async function refresh(refreshToken: string): Promise<TokenPair> {
  const response = await apiRequest(API.auth.session.refresh, {
    method: "POST",
    body: { refreshToken },
    schema: sessionTokenSchema,
  });
  return response.data;
}

export async function logout(): Promise<void> {
  await withSessionToken(async (sessionToken) => {
    await apiRequest(API.auth.session.logout, { method: "POST", sessionToken });
  });
  clearSessionTokenCache();
}

export async function fetchMe(sessionToken: string): Promise<MeResponse> {
  const response = await apiRequest(API.users.me.get, {
    sessionToken,
    schema: meDetailsSchema,
  });
  return response.data;
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

export async function listUsers(params: ListUsersParams = {}): Promise<ListUsersResponse> {
  return withSessionToken((sessionToken) =>
    apiRequest(API.users.list, {
      sessionToken,
      params: {
        limit: params.pagination?.limit,
        offset: params.pagination?.offset,
        multifactorEnabled: params.filters?.multifactorEnabled,
        role: params.filters?.role || undefined,
        search: params.search || undefined,
      },
      schema: userListSchema,
    })
  );
}

export async function registerUser(payload: RegisterUserPayload): Promise<RegisterUserResponse> {
  return withSessionToken(async (sessionToken) => {
    const response = await apiRequest(API.users.create, {
      method: "POST",
      sessionToken,
      body: payload,
      schema: userSchema,
    });
    return response.data;
  });
}

export async function deleteUser(id: string): Promise<void> {
  return withSessionToken(async (sessionToken) => {
    await apiRequest(apiPath(API.users.delete, { userId: id }), {
      method: "DELETE",
      sessionToken,
    });
  });
}

function isTokenPair(value: unknown): value is TokenPair {
  return (
    typeof value === "object" &&
    value !== null &&
    "sessionToken" in value &&
    typeof (value as TokenPair).sessionToken === "string"
  );
}

export async function initializeVault(
  sessionToken: string,
  payload: VaultInitializePayload
): Promise<VaultSlot[]> {
  const response = await apiRequest(API.users.me.vault.initialize, {
    method: "POST",
    sessionToken,
    body: payload,
    schema: vaultSlotsSchema,
  });
  return response.data.vaultSlots;
}

export async function createVaultSlot(
  sessionToken: string,
  payload: VaultSlotPayload
): Promise<VaultSlot> {
  const response = await apiRequest(API.users.me.vault.slots.create, {
    method: "POST",
    sessionToken,
    body: payload,
    schema: vaultSlotSchema,
  });
  return response.data;
}

export async function updateVaultSlot(
  sessionToken: string,
  slotID: string,
  payload: Pick<VaultSlotPayload, "salt" | "wrapBlob" | "password">
): Promise<VaultSlot> {
  const response = await apiRequest(apiPath(API.users.me.vault.slots.patch, { slotId: slotID }), {
    method: "PUT",
    sessionToken,
    body: payload,
    schema: vaultSlotSchema,
  });
  return response.data;
}

export async function deleteVaultSlot(
  sessionToken: string,
  slotID: string,
  payload?: { password?: string }
): Promise<void> {
  await apiRequest(apiPath(API.users.me.vault.slots.delete, { slotId: slotID }), {
    method: "DELETE",
    sessionToken,
    body: payload,
  });
}

export async function patchMeWithToken(
  sessionToken: string,
  payload: PatchMePayload
): Promise<TokenPair | null> {
  const response = await apiRequest(API.users.me.patch, {
    method: "PATCH",
    sessionToken,
    body: payload,
    schema: patchMeSchema,
  });
  const data = response.data;
  if (isTokenPair(data)) {
    applyTokenPair(data);
    return data;
  }
  return null;
}

export async function setRecoveryEmail(payload: RecoveryEmailPayload): Promise<MeResponse> {
  return withSessionToken(async (sessionToken) => {
    await patchMeWithToken(sessionToken, {
      recoveryEmail: payload.recoveryEmail,
      currentPassword: payload.currentPassword,
    });
    return fetchMe(sessionToken);
  });
}

export async function clearRecoveryEmail(payload: {
  currentPassword: string;
}): Promise<MeResponse> {
  return withSessionToken(async (sessionToken) => {
    await patchMeWithToken(sessionToken, {
      recoveryEmail: null,
      currentPassword: payload.currentPassword,
    });
    return fetchMe(sessionToken);
  });
}
