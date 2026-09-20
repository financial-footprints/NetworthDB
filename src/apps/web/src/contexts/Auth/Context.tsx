import { runAuthBootstrap } from "@web/contexts/Auth/bootstrap";
import { clearRefreshToken, readRefreshToken } from "@web/contexts/Auth/storage";
import { setCachedAuthUser } from "@web/contexts/Auth/user";
import {
  applyTokenPair,
  clearSessionTokenCache,
  fetchMe,
  getSessionToken,
  login as loginRequest,
  logout as logoutRequest,
  refreshSessionToken,
} from "@web/utils/api/routes/auth";
import type {
  AuthUser,
  LoginResult,
  MeResponse,
  TokenPair,
} from "@web/utils/api/routes/auth/types";
import { invalidateCreditCardCatalogBulk } from "@web/utils/api/routes/credit-cards";
import { decryptDisplayName, meToAuthUser } from "@web/utils/crypto/profile";
import { clearDEK, readDEK, writeDEK } from "@web/utils/crypto/session";
import {
  type AutoUnlockResult,
  ensureVaultAtLogin,
  tryAutoUnlock,
  type UnlockContext,
} from "@web/utils/crypto/vault";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type VaultStatus = "none" | "unlocked" | "locked";

type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  status: AuthStatus;
  vaultStatus: VaultStatus;
  user: AuthUser | null;
  me: MeResponse | null;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  updateDisplayName: (name: string | null) => void;
  applyMe: (me: MeResponse) => Promise<void>;
  establishAuth: (tokens: TokenPair) => Promise<MeResponse>;
  completeLoginWithPassword: (
    tokens: TokenPair,
    password: string,
    ctx?: Omit<UnlockContext, "password">
  ) => Promise<AutoUnlockResult>;
  completeVaultSetup: (password: string) => Promise<AutoUnlockResult>;
  vaultSetupInProgress: boolean;
  reconcileVault: (me: MeResponse, ctx?: UnlockContext) => Promise<AutoUnlockResult>;
  completeVaultUnlock: (dek: CryptoKey, me?: MeResponse) => Promise<void>;
  setVaultLocked: (me: MeResponse) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function vaultStatusFromMe(me: MeResponse): Promise<VaultStatus> {
  if (!me.vaultInitialized) {
    return "none";
  }
  const dek = await readDEK();
  return dek ? "unlocked" : "locked";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [vaultStatus, setVaultStatus] = useState<VaultStatus>("none");
  const [vaultSetupInProgress, setVaultSetupInProgress] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const meRef = useRef<MeResponse | null>(null);
  meRef.current = me;

  const applyMe = useCallback(async (nextMe: MeResponse) => {
    const dek = await readDEK();
    const name = await decryptDisplayName(nextMe, dek);
    setMe(nextMe);
    setUser(meToAuthUser(nextMe, name));
    setVaultStatus(await vaultStatusFromMe(nextMe));
    setStatus("authenticated");
  }, []);

  const completeVaultUnlock = useCallback(async (dek: CryptoKey, nextMe?: MeResponse) => {
    await writeDEK(dek);
    const activeMe = nextMe ?? meRef.current;
    if (!activeMe) {
      setVaultStatus("unlocked");
      return;
    }
    const name = await decryptDisplayName(activeMe, dek);
    setMe(activeMe);
    setUser(meToAuthUser(activeMe, name));
    setVaultStatus("unlocked");
    setStatus("authenticated");
  }, []);

  const setVaultLocked = useCallback((nextMe: MeResponse) => {
    setMe(nextMe);
    setUser(meToAuthUser(nextMe, null));
    setVaultStatus("locked");
    setStatus("authenticated");
  }, []);

  const reconcileVault = useCallback(
    async (nextMe: MeResponse, ctx: UnlockContext = {}): Promise<AutoUnlockResult> => {
      const result = await tryAutoUnlock(nextMe, ctx);
      if (result.kind === "no_vault") {
        setMe(nextMe);
        setUser(meToAuthUser(nextMe, null));
        setVaultStatus("none");
        setStatus("authenticated");
        return result;
      }
      if (result.kind === "unlocked") {
        await completeVaultUnlock(result.dek, nextMe);
        return result;
      }
      setVaultLocked(nextMe);
      return result;
    },
    [completeVaultUnlock, setVaultLocked]
  );

  const establishAuth = useCallback(async (tokens: TokenPair) => {
    applyTokenPair(tokens);
    const nextMe = await fetchMe(tokens.sessionToken);
    const nextVaultStatus = await vaultStatusFromMe(nextMe);

    setMe(nextMe);
    if (nextVaultStatus === "unlocked") {
      const dek = await readDEK();
      const name = dek !== null ? await decryptDisplayName(nextMe, dek) : null;
      setUser(meToAuthUser(nextMe, name));
      setVaultStatus("unlocked");
    } else if (nextVaultStatus === "none") {
      setUser(meToAuthUser(nextMe, null));
      setVaultStatus("none");
    } else {
      setUser(meToAuthUser(nextMe, null));
      setVaultStatus("locked");
    }
    setStatus("authenticated");
    return nextMe;
  }, []);

  const completeLoginWithPassword = useCallback(
    async (
      tokens: TokenPair,
      password: string,
      ctx: Omit<UnlockContext, "password"> = {}
    ): Promise<AutoUnlockResult> => {
      setVaultSetupInProgress(true);
      try {
        let nextMe = await establishAuth(tokens);
        nextMe = await ensureVaultAtLogin(tokens.sessionToken, nextMe, password);
        return await reconcileVault(nextMe, { ...ctx, password });
      } finally {
        setVaultSetupInProgress(false);
      }
    },
    [establishAuth, reconcileVault]
  );

  const completeVaultSetup = useCallback(
    async (password: string): Promise<AutoUnlockResult> => {
      const activeMe = meRef.current;
      if (!activeMe) {
        throw new Error("Not signed in.");
      }

      setVaultSetupInProgress(true);
      try {
        const sessionToken = await getSessionToken();
        const nextMe = await ensureVaultAtLogin(sessionToken, activeMe, password);
        return await reconcileVault(nextMe, { password });
      } finally {
        setVaultSetupInProgress(false);
      }
    },
    [reconcileVault]
  );

  const clearSession = useCallback(() => {
    clearRefreshToken();
    clearSessionTokenCache();
    invalidateCreditCardCatalogBulk();
    clearDEK();
    setMe(null);
    setUser(null);
    setVaultStatus("none");
    setStatus("anonymous");
  }, []);

  const updateDisplayName = useCallback((name: string | null) => {
    setUser((current) => (current ? { ...current, displayName: name } : current));
  }, []);

  const establishAuthRef = useRef(establishAuth);
  const reconcileVaultRef = useRef(reconcileVault);
  const clearSessionRef = useRef(clearSession);
  establishAuthRef.current = establishAuth;
  reconcileVaultRef.current = reconcileVault;
  clearSessionRef.current = clearSession;

  useEffect(() => {
    setCachedAuthUser(user);
  }, [user]);

  useEffect(() => {
    void runAuthBootstrap({
      readRefreshToken,
      refreshSessionToken,
      establishAuth: (tokens) => establishAuthRef.current(tokens),
      reconcileVault: (nextMe, ctx) => reconcileVaultRef.current(nextMe, ctx),
      clearSession: () => clearSessionRef.current(),
      setAnonymous: () => setStatus("anonymous"),
    });
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<LoginResult> => {
      const result = await loginRequest(username, password);
      if (result.kind === "authenticated") {
        await completeLoginWithPassword(result.tokens, password);
      }
      return result;
    },
    [completeLoginWithPassword]
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Clear local session even when the server rejects the token.
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      status,
      vaultStatus,
      user,
      me,
      login,
      logout,
      updateDisplayName,
      applyMe,
      establishAuth,
      completeLoginWithPassword,
      completeVaultSetup,
      vaultSetupInProgress,
      reconcileVault,
      completeVaultUnlock,
      setVaultLocked,
    }),
    [
      status,
      vaultStatus,
      user,
      me,
      login,
      logout,
      updateDisplayName,
      applyMe,
      establishAuth,
      completeLoginWithPassword,
      completeVaultSetup,
      vaultSetupInProgress,
      reconcileVault,
      completeVaultUnlock,
      setVaultLocked,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
