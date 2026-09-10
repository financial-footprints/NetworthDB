export class WebAuthnSession {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly sessionData: Buffer,
    public readonly expiresAt: Date,
    public readonly createdAt: Date
  ) {}

  isValid(at: Date = new Date()): boolean {
    return this.expiresAt.getTime() > at.getTime();
  }
}
