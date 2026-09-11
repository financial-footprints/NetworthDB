export type DomainErrorCode =
  | "not_found"
  | "conflict"
  | "invalid_input"
  | "unauthorized"
  | "forbidden"
  | "too_many_requests"
  | "internal";

export class DomainError extends Error {
  public readonly code: DomainErrorCode;
  public readonly context?: Record<string, unknown>;
  public readonly cause?: unknown;

  constructor(
    message: string,
    options?: {
      code?: DomainErrorCode;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = options?.code ?? "internal";
    this.context = options?.context;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class EntityNotFoundError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>, cause?: Error) {
    super(message, {
      code: "not_found",
      context,
      cause,
    });
  }
}

export class ValidationError extends DomainError {
  public readonly field?: string;

  constructor(
    message: string,
    options?: Record<string, unknown> & { field?: string; value?: unknown; cause?: Error }
  ) {
    const { cause, field, ...context } = options ?? {};
    super(message, {
      code: "invalid_input",
      context: Object.keys(context).length > 0 ? context : undefined,
      cause,
    });
    this.field = field;
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, {
      code: "conflict",
      context,
    });
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Unauthorized", context?: Record<string, unknown>) {
    super(message, {
      code: "unauthorized",
      context,
    });
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Forbidden", context?: Record<string, unknown>) {
    super(message, {
      code: "forbidden",
      context,
    });
  }
}

export class TooManyRequestsError extends DomainError {
  constructor(message = "too many requests", context?: Record<string, unknown>) {
    super(message, {
      code: "too_many_requests",
      context,
    });
  }
}
