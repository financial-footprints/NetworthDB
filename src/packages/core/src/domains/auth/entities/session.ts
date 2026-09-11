export class Session {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly sessionHash: string,
    public readonly refreshHash: string,
    public readonly sessionExpiresAt: Date,
    public readonly refreshExpiresAt: Date,
    public readonly createdAt: Date,
    public readonly authAmr: string,
    public readonly authAcr: string,
    public readonly revokedAt: Date | null = null
  ) {}

  isSessionValid(at: Date = new Date()): boolean {
    return this.revokedAt === null && this.sessionExpiresAt.getTime() > at.getTime();
  }

  isRefreshValid(at: Date = new Date()): boolean {
    return this.revokedAt === null && this.refreshExpiresAt.getTime() > at.getTime();
  }

  withRevoked(at: Date): Session {
    return new Session(
      this.id,
      this.userId,
      this.sessionHash,
      this.refreshHash,
      this.sessionExpiresAt,
      this.refreshExpiresAt,
      this.createdAt,
      this.authAmr,
      this.authAcr,
      at
    );
  }

  withRotatedTokens(input: {
    sessionHash: string;
    refreshHash: string;
    sessionExpiresAt: Date;
    refreshExpiresAt: Date;
  }): Session {
    return new Session(
      this.id,
      this.userId,
      input.sessionHash,
      input.refreshHash,
      input.sessionExpiresAt,
      input.refreshExpiresAt,
      this.createdAt,
      this.authAmr,
      this.authAcr,
      this.revokedAt
    );
  }
}
