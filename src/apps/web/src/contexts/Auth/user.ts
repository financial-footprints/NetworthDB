import type { AuthUser } from "@web/utils/api/routes/auth/types";

let cachedUser: AuthUser | null = null;

export function setCachedAuthUser(user: AuthUser | null): void {
  cachedUser = user;
}

export function isTotpEnrolled(): boolean {
  return cachedUser?.multifactorMethods.includes("totp") ?? false;
}
