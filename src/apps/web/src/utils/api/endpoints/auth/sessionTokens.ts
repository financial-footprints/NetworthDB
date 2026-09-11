import type { TokenPair } from "@web/utils/api/endpoints/auth/types";

/** Refresh this long before session token expiry. */
const REFRESH_SKEW_MS = 60_000;

type CachedSessionToken = {
  sessionToken: string;
  expiresAtMs: number;
};

let cached: CachedSessionToken | null = null;

export function writeSessionTokenCache(tokens: TokenPair): void {
  cached = {
    sessionToken: tokens.session_token,
    expiresAtMs: Date.now() + tokens.expires_in * 1000,
  };
}

export function readCachedSessionToken(nowMs: number = Date.now()): string | null {
  if (!cached) {
    return null;
  }
  if (nowMs >= cached.expiresAtMs - REFRESH_SKEW_MS) {
    return null;
  }
  return cached.sessionToken;
}

export function clearSessionTokenCache(): void {
  cached = null;
}
