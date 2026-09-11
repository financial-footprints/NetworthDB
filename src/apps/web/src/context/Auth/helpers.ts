import type { MeResponse, TokenPair } from "@web/utils/api/endpoints/auth/types";
import { ApiError } from "@web/utils/api/types";
import type { AutoUnlockResult, UnlockContext } from "@web/utils/crypto/vault";

/** Whether bootstrap should wipe the refresh token after a failed session restore. */
export function shouldClearSessionOnBootstrapError(error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 429 || error.status >= 500)) {
    return false;
  }
  return true;
}

type BootstrapCallbacks = {
  readRefreshToken: () => string | null;
  refreshSessionToken: () => Promise<TokenPair>;
  establishAuth: (tokens: TokenPair) => Promise<MeResponse>;
  reconcileVault: (me: MeResponse, ctx: UnlockContext) => Promise<AutoUnlockResult>;
  clearSession: () => void;
  setAnonymous: () => void;
};

let bootstrapPromise: Promise<void> | null = null;

export function runAuthBootstrap(callbacks: BootstrapCallbacks): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      if (!callbacks.readRefreshToken()) {
        callbacks.setAnonymous();
        return;
      }

      try {
        const tokens = await callbacks.refreshSessionToken();
        const nextMe = await callbacks.establishAuth(tokens);
        await callbacks.reconcileVault(nextMe, {});
      } catch (error) {
        if (!shouldClearSessionOnBootstrapError(error)) {
          callbacks.setAnonymous();
          return;
        }
        callbacks.clearSession();
      }
    })().finally(() => {
      bootstrapPromise = null;
    });
  }
  return bootstrapPromise;
}
