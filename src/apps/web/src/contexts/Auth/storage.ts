const REFRESH_TOKEN_KEY = "ndb_refresh_token";

export function readRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeRefreshToken(token: string): void {
  sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearRefreshToken(): void {
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}
