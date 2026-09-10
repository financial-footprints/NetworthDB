export class TotpState {
  constructor(
    public readonly totpConfirmedAt: Date | null = null,
    public readonly totpSecretCiphertext: string | null = null,
    public readonly totpSecretNonce: string | null = null,
    public readonly totpPendingCiphertext: string | null = null,
    public readonly totpPendingNonce: string | null = null,
    public readonly totpLastStep: number | null = null,
    public readonly multifactorFailedCount: number = 0,
    public readonly multifactorLockedUntil: Date | null = null
  ) {}

  static empty(): TotpState {
    return new TotpState();
  }

  hasTotp(): boolean {
    return this.totpConfirmedAt !== null;
  }

  hasPending(): boolean {
    return this.totpPendingCiphertext !== null && this.totpPendingNonce !== null;
  }

  isLocked(at: Date = new Date()): boolean {
    return (
      this.multifactorLockedUntil !== null && this.multifactorLockedUntil.getTime() > at.getTime()
    );
  }

  withPending(ciphertext: string, nonce: string): TotpState {
    return new TotpState(
      this.totpConfirmedAt,
      this.totpSecretCiphertext,
      this.totpSecretNonce,
      ciphertext,
      nonce,
      this.totpLastStep,
      this.multifactorFailedCount,
      this.multifactorLockedUntil
    );
  }

  withConfirmed(
    secret: { ciphertext: string; nonce: string },
    confirmedAt: Date,
    step: number
  ): TotpState {
    return new TotpState(confirmedAt, secret.ciphertext, secret.nonce, null, null, step, 0, null);
  }

  withLastStep(step: number): TotpState {
    return new TotpState(
      this.totpConfirmedAt,
      this.totpSecretCiphertext,
      this.totpSecretNonce,
      this.totpPendingCiphertext,
      this.totpPendingNonce,
      step,
      this.multifactorFailedCount,
      this.multifactorLockedUntil
    );
  }

  withFailure(count: number, lockedUntil: Date | null): TotpState {
    return new TotpState(
      this.totpConfirmedAt,
      this.totpSecretCiphertext,
      this.totpSecretNonce,
      this.totpPendingCiphertext,
      this.totpPendingNonce,
      this.totpLastStep,
      count,
      lockedUntil
    );
  }

  withResetFailures(): TotpState {
    return new TotpState(
      this.totpConfirmedAt,
      this.totpSecretCiphertext,
      this.totpSecretNonce,
      this.totpPendingCiphertext,
      this.totpPendingNonce,
      this.totpLastStep,
      0,
      null
    );
  }

  cleared(): TotpState {
    return new TotpState(null, null, null, null, null, null, 0, null);
  }
}
