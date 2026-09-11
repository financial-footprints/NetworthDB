export class MultifactorChallenge {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly tokenHash: string,
    public readonly expiresAt: Date,
    public readonly createdAt: Date,
    public readonly usedAt: Date | null = null
  ) {}

  isValid(at: Date = new Date()): boolean {
    return this.usedAt === null && this.expiresAt.getTime() > at.getTime();
  }

  withUsed(at: Date): MultifactorChallenge {
    return new MultifactorChallenge(
      this.id,
      this.userId,
      this.tokenHash,
      this.expiresAt,
      this.createdAt,
      at
    );
  }
}
