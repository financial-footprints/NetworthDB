export class TotpState {
  constructor(
    public readonly totpConfirmedAt: Date | null = null,
    public readonly totpSecret: Buffer | null = null,
    public readonly totpPending: Buffer | null = null,
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
    return this.totpPending !== null;
  }

  isLocked(at: Date = new Date()): boolean {
    return (
      this.multifactorLockedUntil !== null && this.multifactorLockedUntil.getTime() > at.getTime()
    );
  }

  withPending(blob: Buffer): TotpState {
    return new TotpState(
      this.totpConfirmedAt,
      this.totpSecret,
      blob,
      this.totpLastStep,
      this.multifactorFailedCount,
      this.multifactorLockedUntil
    );
  }

  withConfirmed(blob: Buffer, confirmedAt: Date, step: number): TotpState {
    return new TotpState(confirmedAt, blob, null, step, 0, null);
  }

  withLastStep(step: number): TotpState {
    return new TotpState(
      this.totpConfirmedAt,
      this.totpSecret,
      this.totpPending,
      step,
      this.multifactorFailedCount,
      this.multifactorLockedUntil
    );
  }

  withFailure(count: number, lockedUntil: Date | null): TotpState {
    return new TotpState(
      this.totpConfirmedAt,
      this.totpSecret,
      this.totpPending,
      this.totpLastStep,
      count,
      lockedUntil
    );
  }

  withResetFailures(): TotpState {
    return new TotpState(
      this.totpConfirmedAt,
      this.totpSecret,
      this.totpPending,
      this.totpLastStep,
      0,
      null
    );
  }

  cleared(): TotpState {
    return new TotpState(null, null, null, null, 0, null);
  }
}
