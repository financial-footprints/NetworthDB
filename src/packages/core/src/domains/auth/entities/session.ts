export class Session {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly accessHash: string,
    public readonly refreshHash: string,
    public readonly accessExpiresAt: Date,
    public readonly refreshExpiresAt: Date,
    public readonly createdAt: Date,
    public readonly authAmr: string,
    public readonly authAcr: string,
    public readonly revokedAt: Date | null = null
  ) {}

  isAccessValid(at: Date = new Date()): boolean {
    return this.revokedAt === null && this.accessExpiresAt.getTime() > at.getTime();
  }

  isRefreshValid(at: Date = new Date()): boolean {
    return this.revokedAt === null && this.refreshExpiresAt.getTime() > at.getTime();
  }

  withRevoked(at: Date): Session {
    return new Session(
      this.id,
      this.userId,
      this.accessHash,
      this.refreshHash,
      this.accessExpiresAt,
      this.refreshExpiresAt,
      this.createdAt,
      this.authAmr,
      this.authAcr,
      at
    );
  }

  withRotatedTokens(input: {
    accessHash: string;
    refreshHash: string;
    accessExpiresAt: Date;
    refreshExpiresAt: Date;
  }): Session {
    return new Session(
      this.id,
      this.userId,
      input.accessHash,
      input.refreshHash,
      input.accessExpiresAt,
      input.refreshExpiresAt,
      this.createdAt,
      this.authAmr,
      this.authAcr,
      this.revokedAt
    );
  }
}
