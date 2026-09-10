import { generateSessionToken, hashSessionToken } from "@core/domains/auth/embedded/crypto";
import { Session } from "@core/domains/auth/entities/session";
import type { AuthContext, SessionTokenPair } from "@core/domains/auth/helpers";
import type { SessionRepository } from "@core/domains/auth/repositories/session-repository";
import { findFirst } from "@core/shared/query";

type SessionLifecycleConfig = {
  sessionTtl: number;
  refreshTtl: number;
};

type SessionRevokeTarget = { sessionId: string } | { userId: string };

export class SessionLifecycle {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly config: SessionLifecycleConfig
  ) {}

  async issue(userId: string, auth: AuthContext): Promise<SessionTokenPair> {
    const pair = this._createTokenPair();
    const now = new Date();
    const session = new Session(
      crypto.randomUUID(),
      userId,
      hashSessionToken(pair.sessionToken),
      hashSessionToken(pair.refreshToken),
      new Date(now.getTime() + this.config.sessionTtl * 1000),
      new Date(now.getTime() + this.config.refreshTtl * 1000),
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
      accessHash: hashSessionToken(pair.sessionToken),
      refreshHash: hashSessionToken(pair.refreshToken),
      accessExpiresAt: new Date(now.getTime() + this.config.sessionTtl * 1000),
      refreshExpiresAt: new Date(now.getTime() + this.config.refreshTtl * 1000),
    });
    await this.sessions.save(rotated);

    return pair;
  }

  async findByRefreshToken(refreshToken: string): Promise<Session | null> {
    return findFirst(this.sessions.findByFilters.bind(this.sessions), {
      refreshHash: hashSessionToken(refreshToken),
    });
  }

  async findValidAccess(accessToken: string): Promise<Session | null> {
    const session = await findFirst(this.sessions.findByFilters.bind(this.sessions), {
      accessHash: hashSessionToken(accessToken),
    });
    if (!session?.isAccessValid()) {
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
      sessionToken: generateSessionToken(),
      refreshToken: generateSessionToken(),
      tokenType: "Bearer",
      expiresIn: Math.floor(this.config.sessionTtl / 1000),
    };
  }
}
