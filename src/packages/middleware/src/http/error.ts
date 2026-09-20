import type { Logger } from "@ndb/core";
import {
  BusinessRuleError,
  ConflictError,
  DomainError,
  EntityNotFoundError,
  ForbiddenError,
  STALE_UPDATE_CODE,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from "@ndb/core";
import { type ApiErrorResponse, REQUEST_ID_HEADER } from "@ndb/platform";
import type { Context, ErrorHandler } from "hono";

type HandledStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500;

function omitUndefinedValues(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function withRayId(c: Context, response: ApiErrorResponse): ApiErrorResponse {
  const rayId = c.header(REQUEST_ID_HEADER) ?? c.req.header(REQUEST_ID_HEADER);
  if (typeof rayId !== "string" || rayId.length === 0) {
    return response;
  }

  return { ...response, rayId };
}

function statusCode(error: Error): HandledStatus {
  if (error instanceof UnauthorizedError) {
    return 401;
  }

  if (error instanceof ForbiddenError) {
    return 403;
  }

  if (error instanceof EntityNotFoundError) {
    return 404;
  }

  if (error instanceof ValidationError) {
    return 400;
  }

  if (error instanceof ConflictError) {
    return 409;
  }

  if (error instanceof TooManyRequestsError) {
    return 429;
  }

  if (error instanceof BusinessRuleError) {
    if (error.code === STALE_UPDATE_CODE) {
      return 409;
    }

    return 422;
  }

  if (error instanceof DomainError) {
    return 500;
  }

  return 500;
}

function formatError(error: Error): ApiErrorResponse {
  if (error instanceof UnauthorizedError) {
    return {
      error: "Unauthorized",
      code: error.code,
      details: { reason: error.message },
    };
  }

  if (error instanceof ForbiddenError) {
    return {
      error: error.message,
      code: error.code,
      ...(error.context ? { details: error.context } : {}),
    };
  }

  if (error instanceof ValidationError) {
    const response: ApiErrorResponse = {
      error: error.message,
      code: error.code,
    };

    if (error.field) {
      response.field = error.field;
    }

    if (error.context) {
      const details = omitUndefinedValues(error.context);
      if (Object.keys(details).length > 0) {
        response.details = details;
      }
    }

    return response;
  }

  if (
    error instanceof ConflictError ||
    error instanceof BusinessRuleError ||
    error instanceof EntityNotFoundError ||
    error instanceof DomainError
  ) {
    return {
      error: error.message,
      code: error.code,
      details: error.context,
    };
  }

  return {
    error: "An unexpected error occurred",
    code: "INTERNAL_ERROR",
  };
}

export function errorHandler(logger: Logger): ErrorHandler {
  return (error, c) => {
    const status = statusCode(error);
    const response = withRayId(c, formatError(error));

    const logContext: Record<string, unknown> = {
      method: c.req.method,
      path: c.req.path,
      status,
      code: response.code,
      reason: error instanceof Error ? error.message : String(error),
      error,
    };

    if (typeof response.rayId === "string") {
      logContext.rayId = response.rayId;
    }

    if (status >= 500) {
      logger.error("middleware.error.internal", logContext);
    } else {
      logger.warn("middleware.error.client", logContext);
    }

    return c.json(response, status);
  };
}
