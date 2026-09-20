/**
 * Base class for all domain-specific errors.
 */
export class DomainError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: string;
  public readonly cause?: unknown;

  constructor(
    message: string,
    options?: {
      code?: string;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = options?.code ?? "DOMAIN_ERROR";
    this.context = options?.context;
    this.timestamp = new Date().toISOString();
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
    };
  }
}

export class EntityNotFoundError extends DomainError {
  constructor(entityName: string, id: string, extra?: Record<string, unknown>, cause?: Error) {
    super(`${entityName} with id '${id}' not found`, {
      code: "ENTITY_NOT_FOUND",
      context: { entityName, id, ...extra },
      cause,
    });
  }
}

function omitUndefinedValues(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

export class ValidationError extends DomainError {
  public readonly field?: string;

  constructor(
    message: string,
    options?: {
      field?: string;
      value?: unknown;
      cause?: Error;
      context?: Record<string, unknown>;
    }
  ) {
    const context = omitUndefinedValues({
      field: options?.field,
      value: options?.value,
      ...options?.context,
    });

    super(message, {
      code: "VALIDATION_ERROR",
      context: Object.keys(context).length > 0 ? context : undefined,
      cause: options?.cause,
    });
    this.field = options?.field;
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Unauthorized", context?: Record<string, unknown>) {
    super(message, {
      code: "UNAUTHORIZED",
      context,
    });
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Forbidden", context?: Record<string, unknown>) {
    super(message, {
      code: "FORBIDDEN",
      context,
    });
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, {
      code: "CONFLICT",
      context,
    });
  }
}

export class TooManyRequestsError extends DomainError {
  constructor(message = "Too many requests", context?: Record<string, unknown>) {
    super(message, {
      code: "TOO_MANY_REQUESTS",
      context,
    });
  }
}

export class BusinessRuleError extends DomainError {
  constructor(message: string, ruleCode: string, context?: Record<string, unknown>, cause?: Error) {
    super(message, {
      code: ruleCode,
      context,
      cause,
    });
  }
}

export const STALE_UPDATE_CODE = "STALE_UPDATE";

export function staleUpdateError(
  expectedVersion: number,
  actualVersion: number
): BusinessRuleError {
  return new BusinessRuleError(
    "This was updated by someone else. Reload and try again.",
    STALE_UPDATE_CODE,
    { expectedVersion, actualVersion }
  );
}
