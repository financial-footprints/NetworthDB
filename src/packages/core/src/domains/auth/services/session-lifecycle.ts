import { Session } from "@core/domains/auth/entities/session";
import type { AuthContext, SessionTokenPair } from "@core/domains/auth/helpers";
import type { SessionRepository } from "@core/domains/auth/repositories/session-repository";
import type { TokenDigest } from "@core/ports/auth";
import { findFirst } from "@core/shared/query";

const TOKEN_BYTE_LENGTH = 32;

type SessionLifecycleConfig = {
  session: number;
  refresh: number;
};

type SessionRevokeTarget = { sessionId: string } | { userId: string };

export class SessionLifecycle {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly tokens: TokenDigest,
    private readonly ttl: SessionLifecycleConfig
  ) {}

  async issue(userId: string, auth: AuthContext): Promise<SessionTokenPair> {
    const pair = this._createTokenPair();
    const now = new Date();
    const session = new Session(
      crypto.randomUUID(),
      userId,
      this.tokens.sha256Hex(pair.sessionToken),
      this.tokens.sha256Hex(pair.refreshToken),
      new Date(now.getTime() + this.ttl.session * 1000),
      new Date(now.getTime() + this.ttl.refresh * 1000),
      now,
      auth.amr,
      auth.acr
    );
    await this.sessions.create(session);

    return pair;
  }

  async rotate(session: Session): Promise<SessionTokenPair> {
    const pair = this._createTokenPair();
    const now = new Date();
    const rotated = session.withRotatedTokens({
      sessionHash: this.tokens.sha256Hex(pair.sessionToken),
      refreshHash: this.tokens.sha256Hex(pair.refreshToken),
      sessionExpiresAt: new Date(now.getTime() + this.ttl.session * 1000),
      refreshExpiresAt: new Date(now.getTime() + this.ttl.refresh * 1000),
    });
    await this.sessions.save(rotated);

    return pair;
  }

  async findByRefreshToken(refreshToken: string): Promise<Session | null> {
    return findFirst(this.sessions.findByFilters.bind(this.sessions), {
      refreshHash: this.tokens.sha256Hex(refreshToken),
    });
  }

  async findValidSession(sessionToken: string): Promise<Session | null> {
    const session = await findFirst(this.sessions.findByFilters.bind(this.sessions), {
      sessionHash: this.tokens.sha256Hex(sessionToken),
    });
    if (!session?.isSessionValid()) {
      return null;
    }

    return session;
  }

  async revoke(target: SessionRevokeTarget): Promise<void> {
    if ("sessionId" in target) {
      const session = await this.sessions.findById(target.sessionId);
      if (!session || session.revokedAt !== null) {
        return;
      }

      await this.sessions.save(session.withRevoked(new Date()));
      return;
    }

    await this.sessions.delete({ userId: target.userId });
  }

  private _createTokenPair(): SessionTokenPair {
    return {
      sessionToken: this.tokens.randomHex(TOKEN_BYTE_LENGTH),
      refreshToken: this.tokens.randomHex(TOKEN_BYTE_LENGTH),
      expiresIn: Math.floor(this.ttl.session / 1000),
    };
  }
}
