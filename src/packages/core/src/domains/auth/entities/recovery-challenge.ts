export class RecoveryChallenge {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly kind: string,
    public readonly secretHash: string,
    public readonly expiresAt: Date,
    public readonly createdAt: Date,
    public readonly usedAt: Date | null = null
  ) {}

  isValid(at: Date = new Date()): boolean {
    return this.usedAt === null && this.expiresAt.getTime() > at.getTime();
  }

  withUsed(at: Date): RecoveryChallenge {
    return new RecoveryChallenge(
      this.id,
      this.userId,
      this.kind,
      this.secretHash,
      this.expiresAt,
      this.createdAt,
      at
    );
  }
}
