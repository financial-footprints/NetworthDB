export class WebAuthnCredential {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly credentialId: Buffer,
    public readonly publicKey: Buffer,
    public readonly attestationType: string,
    public readonly transport: string,
    public readonly signCount: number,
    public readonly backupEligible: boolean,
    public readonly backupState: boolean,
    public readonly name: string,
    public readonly aaguid: Buffer,
    public readonly createdAt: Date
  ) {}

  withAuthenticatorState(signCount: number, backupState: boolean): WebAuthnCredential {
    return new WebAuthnCredential(
      this.id,
      this.userId,
      this.credentialId,
      this.publicKey,
      this.attestationType,
      this.transport,
      signCount,
      this.backupEligible,
      backupState,
      this.name,
      this.aaguid,
      this.createdAt
    );
  }
}
