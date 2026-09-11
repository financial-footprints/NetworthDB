import { afterEach, describe, expect, mock, test } from "bun:test";
import { runAuthBootstrap } from "@web/context/Auth/helpers";
import type { MeResponse, TokenPair } from "@web/utils/api/endpoints/auth/types";
import { ApiError } from "@web/utils/api/types";

const tokens: TokenPair = {
  session_token: "access",
  refresh_token: "refresh",
  expires_in: 3600,
};

const me: MeResponse = {
  id: "user-1",
  username: "alice",
  role: "user",
  multifactor_enabled: false,
  multifactor_methods: [],
  recovery_codes_enabled: false,
  recovery_email_enabled: false,
  recovery_email_set_at: null,
  vault_initialized: false,
  vault_slots: [],
  display_name: null,
};

function createCallbacks(overrides: Partial<Parameters<typeof runAuthBootstrap>[0]> = {}) {
  return {
    readRefreshToken: mock(() => "refresh-token"),
    refreshSessionToken: mock(async () => tokens),
    establishAuth: mock(async () => me),
    reconcileVault: mock(async () => ({ kind: "no_vault" as const })),
    clearSession: mock(() => {}),
    setAnonymous: mock(() => {}),
    ...overrides,
  };
}

describe("runAuthBootstrap", () => {
  afterEach(() => {
    mock.restore();
  });

  test("sets anonymous when no refresh token is stored", async () => {
    const callbacks = createCallbacks({
      readRefreshToken: mock(() => null),
    });

    await runAuthBootstrap(callbacks);

    expect(callbacks.setAnonymous).toHaveBeenCalledTimes(1);
    expect(callbacks.refreshSessionToken).not.toHaveBeenCalled();
    expect(callbacks.clearSession).not.toHaveBeenCalled();
  });

  test("restores session when refresh succeeds", async () => {
    const callbacks = createCallbacks();

    await runAuthBootstrap(callbacks);

    expect(callbacks.refreshSessionToken).toHaveBeenCalledTimes(1);
    expect(callbacks.establishAuth).toHaveBeenCalledWith(tokens);
    expect(callbacks.reconcileVault).toHaveBeenCalledWith(me, {});
    expect(callbacks.setAnonymous).not.toHaveBeenCalled();
    expect(callbacks.clearSession).not.toHaveBeenCalled();
  });

  test("clears session on auth failure", async () => {
    const callbacks = createCallbacks({
      refreshSessionToken: mock(async () => {
        throw new ApiError(401, "unauthorized");
      }),
    });

    await runAuthBootstrap(callbacks);

    expect(callbacks.clearSession).toHaveBeenCalledTimes(1);
    expect(callbacks.setAnonymous).not.toHaveBeenCalled();
  });

  test("sets anonymous without clearing session on rate limit", async () => {
    const callbacks = createCallbacks({
      refreshSessionToken: mock(async () => {
        throw new ApiError(429, "rate limited");
      }),
    });

    await runAuthBootstrap(callbacks);

    expect(callbacks.setAnonymous).toHaveBeenCalledTimes(1);
    expect(callbacks.clearSession).not.toHaveBeenCalled();
  });

  test("deduplicates concurrent bootstrap calls", async () => {
    let resolveRefresh: ((value: TokenPair) => void) | undefined;
    const refreshSessionToken = mock(
      () =>
        new Promise<TokenPair>((resolve) => {
          resolveRefresh = resolve;
        })
    );
    const callbacks = createCallbacks({ refreshSessionToken });

    const first = runAuthBootstrap(callbacks);
    const second = runAuthBootstrap(callbacks);

    resolveRefresh?.(tokens);
    await Promise.all([first, second]);

    expect(refreshSessionToken).toHaveBeenCalledTimes(1);
  });
});
