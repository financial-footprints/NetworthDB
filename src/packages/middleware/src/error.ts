import type { Logger } from "@ndb/logger";
import { type ApiErrorResponse, REQUEST_ID_HEADER } from "@ndb/platform";
import type { Context, ErrorHandler } from "hono";

function withRayId(c: Context, response: ApiErrorResponse): ApiErrorResponse {
  const rayId = c.header(REQUEST_ID_HEADER) ?? c.req.header(REQUEST_ID_HEADER);
  if (typeof rayId !== "string" || rayId.length === 0) {
    return response;
  }

  return { ...response, rayId };
}

export function errorHandler(logger: Logger): ErrorHandler {
  return (error, c: Context) => {
    const statusCode = 500;
    const response = withRayId(c, {
      error: "An unexpected error occurred",
      code: "INTERNAL_ERROR",
    });

    const logContext: Record<string, unknown> = {
      method: c.req.method,
      path: c.req.path,
      statusCode,
      code: response.code,
      reason: error instanceof Error ? error.message : String(error),
      error,
    };

    if (typeof response.rayId === "string") {
      logContext.rayId = response.rayId;
    }

    logger.error("middleware.error.internal", logContext);

    return c.json(response, statusCode);
  };
}
