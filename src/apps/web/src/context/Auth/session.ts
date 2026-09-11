import type { AuthUser } from "@web/utils/api/endpoints/auth/types";

let cachedUser: AuthUser | null = null;

export function setCachedAuthUser(user: AuthUser | null): void {
  cachedUser = user;
}

export function isTotpEnrolled(): boolean {
  return cachedUser?.multifactor_methods.includes("totp") ?? false;
}
