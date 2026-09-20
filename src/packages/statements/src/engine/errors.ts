export class StatementsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatementsError";
  }
}

export class StageError extends StatementsError {}

export class JobCancelledError extends StatementsError {
  constructor() {
    super("statements.job.cancelled");
  }
}

export function raiseIfCancelled(shouldCancel?: () => boolean): void {
  if (shouldCancel?.()) {
    throw new JobCancelledError();
  }
}
