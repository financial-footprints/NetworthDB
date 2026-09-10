export class RecoveryCode {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly codeHash: string,
    public readonly createdAt: Date,
    public readonly usedAt: Date | null = null
  ) {}

  withUsed(at: Date): RecoveryCode {
    return new RecoveryCode(this.id, this.userId, this.codeHash, this.createdAt, at);
  }
}
