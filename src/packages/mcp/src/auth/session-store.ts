import { ApiClient, type FetchImpl } from "@mcp/api/client";
import { McpAuthError } from "@mcp/auth/gate";
import { API, parseLoginResponse, type TokenPair } from "@ndb/platform";

const REFRESH_SKEW_MS = 60_000;

type CachedAccess = {
  sessionToken: string;
  expiresAtMs: number;
};

export type SessionUser = {
  id: string;
  username: string;
  role: string;
  multifactorEnabled: boolean;
  aal: "aal1" | "aal2";
};

export type SessionState =
  | { authenticated: false; user: null }
  | { authenticated: true; user: SessionUser };

export type AuthLoginInput = {
  username?: string;
  password?: string;
  totp?: string;
  recoveryCode?: string;
  multifactorToken?: string;
};

export type AuthLoginOutcome =
  | { kind: "authenticated" }
  | {
      kind: "mfa_required";
      methods: string[];
      multifactorToken: string;
    }
  | {
      kind: "mfa_enrollment_required";
      methods: string[];
      multifactorToken: string;
    };

type MeApi = {
  id: string;
  username: string;
  role: string;
  multifactorEnabled: boolean;
};

export type SessionStoreOptions = {
  apiOrigin: string;
  fetchImpl?: FetchImpl;
};

/** Long enough for a single HTTP MCP request without refresh skew. */
const BEARER_ONLY_CACHE_MS = 3_600_000;

export class SessionStore {
  private readonly api: ApiClient;
  private refreshToken: string | null = null;
  private cached: CachedAccess | null = null;
  private user: Omit<SessionUser, "aal"> | null = null;
  private aal: "aal1" | "aal2" = "aal1";
  private pendingMfa: { multifactorToken: string; methods: string[] } | null = null;
  private refreshInFlight: Promise<void> | null = null;
  private accessTokenOnly = false;

  constructor(options: SessionStoreOptions) {
    this.api = new ApiClient({
      apiOrigin: options.apiOrigin,
      fetchImpl: options.fetchImpl,
    });
  }

  getState(): SessionState {
    if (!this.isAuthenticated() || !this.user) {
      return { authenticated: false, user: null };
    }
    return {
      authenticated: true,
      user: { ...this.user, aal: this.aal },
    };
  }

  isAuthenticated(): boolean {
    return this.user !== null && (this.refreshToken !== null || this.accessTokenOnly);
  }

  async authenticateWithAccessToken(sessionToken: string): Promise<void> {
    const trimmed = sessionToken.trim();
    if (!trimmed) {
      throw new McpAuthError();
    }

    this.accessTokenOnly = true;
    this.refreshToken = null;
    this.cached = {
      sessionToken: trimmed,
      expiresAtMs: Date.now() + BEARER_ONLY_CACHE_MS,
    };
    this.aal = "aal1";

    try {
      await this.loadUserProfile();
    } catch (error) {
      this.user = null;
      this.cached = null;
      this.accessTokenOnly = false;
      throw error;
    }
  }

  async login(input: AuthLoginInput): Promise<AuthLoginOutcome> {
    const username = input.username;
    const password = input.password;
    if (username && password) {
      return this.loginWithPassword({ ...input, username, password });
    }

    const multifactorToken = input.multifactorToken ?? this.pendingMfa?.multifactorToken;
    const mfaProof = input.totp ?? input.recoveryCode;
    if (multifactorToken && mfaProof) {
      await this.verifyMultifactor(multifactorToken, {
        totp: input.totp,
        recoveryCode: input.recoveryCode,
      });
      return { kind: "authenticated" };
    }

    throw new Error("mcp.auth.login.missing-credentials");
  }

  private async loginWithPassword(
    input: AuthLoginInput & { username: string; password: string }
  ): Promise<AuthLoginOutcome> {
    const normalizedUsername = input.username.trim().toLowerCase();
    const data = await this.api.post<unknown>(API.auth.session.login, {
      username: normalizedUsername,
      password: input.password,
    });
    const result = parseLoginResponse(data);

    if (result.kind === "authenticated") {
      await this.applyTokens(result.tokens, { fetchProfile: true, fromMfa: false });
      return { kind: "authenticated" };
    }

    this.pendingMfa = {
      multifactorToken: result.multifactorToken,
      methods: result.methods,
    };

    if (input.totp || input.recoveryCode) {
      await this.verifyMultifactor(result.multifactorToken, {
        totp: input.totp,
        recoveryCode: input.recoveryCode,
      });
      return { kind: "authenticated" };
    }

    if (result.kind === "multifactor_enrollment_required") {
      return {
        kind: "mfa_enrollment_required",
        methods: result.methods,
        multifactorToken: result.multifactorToken,
      };
    }

    return {
      kind: "mfa_required",
      methods: result.methods,
      multifactorToken: result.multifactorToken,
    };
  }

  async getJson<T>(path: string): Promise<T> {
    const sessionToken = await this.getAccessToken();
    return this.api.get<T>(path, { sessionToken });
  }

  async requestJson<T>(method: string, path: string, body?: unknown): Promise<T> {
    const sessionToken = await this.getAccessToken();
    return this.api.requestJson<T>(method, path, { sessionToken, body });
  }

  async requestForm<T>(path: string, form: FormData): Promise<T> {
    const sessionToken = await this.getAccessToken();
    return this.api.requestForm<T>(path, form, { sessionToken });
  }

  async requestBytes(path: string) {
    const sessionToken = await this.getAccessToken();
    return this.api.requestBytes(path, { sessionToken });
  }

  async getAccessToken(nowMs: number = Date.now()): Promise<string> {
    const cached = this.readCachedAccess(nowMs);
    if (cached) {
      return cached;
    }
    if (!this.refreshToken) {
      throw new McpAuthError();
    }
    await this.refreshAccessToken();
    const afterRefresh = this.readCachedAccess(nowMs);
    if (!afterRefresh) {
      throw new Error("mcp.auth.refresh.failed");
    }
    return afterRefresh;
  }

  private readCachedAccess(nowMs: number): string | null {
    if (!this.cached) {
      return null;
    }
    if (nowMs >= this.cached.expiresAtMs - REFRESH_SKEW_MS) {
      return null;
    }
    return this.cached.sessionToken;
  }

  private writeCachedAccess(tokens: TokenPair): void {
    this.cached = {
      sessionToken: tokens.sessionToken,
      expiresAtMs: Date.now() + tokens.expiresIn * 1000,
    };
    this.refreshToken = tokens.refreshToken;
    this.accessTokenOnly = false;
  }

  private async verifyMultifactor(
    bearerToken: string,
    payload: { totp?: string; recoveryCode?: string }
  ): Promise<void> {
    const tokens = await this.api.post<TokenPair>(API.auth.session.multifactor.otp, payload, {
      sessionToken: bearerToken,
    });
    await this.applyTokens(tokens, { fetchProfile: true, fromMfa: true });
    this.pendingMfa = null;
  }

  private async applyTokens(
    tokens: TokenPair,
    options: { fetchProfile: boolean; fromMfa: boolean }
  ): Promise<void> {
    this.writeCachedAccess(tokens);
    this.aal = options.fromMfa ? "aal2" : "aal1";
    if (options.fetchProfile) {
      await this.loadUserProfile();
    }
  }

  private async loadUserProfile(): Promise<void> {
    const sessionToken = this.cached?.sessionToken;
    if (!sessionToken) {
      throw new McpAuthError();
    }
    const me = await this.api.get<MeApi>(API.users.me.get, { sessionToken });
    this.user = {
      id: me.id,
      username: me.username,
      role: me.role,
      multifactorEnabled: me.multifactorEnabled,
    };
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.doRefresh().finally(() => {
        this.refreshInFlight = null;
      });
    }
    await this.refreshInFlight;
  }

  private async doRefresh(): Promise<void> {
    if (!this.refreshToken) {
      throw new McpAuthError();
    }
    const tokens = await this.api.post<TokenPair>(API.auth.session.refresh, {
      refreshToken: this.refreshToken,
    });
    this.writeCachedAccess(tokens);
  }
}
