import type { Logger } from "@ndb/logger";
import { REQUEST_ID_HEADER } from "@ndb/platform";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

export interface LogMiddlewareOptions {
  logger: Logger;
}

function log(logger: Logger, c: Context, durationMs: number, rayId: string): void {
  const status = c.res.status;
  const context: Record<string, unknown> = {
    method: c.req.method,
    path: c.req.path,
    status,
    durationMs,
    rayId,
  };

  const query = c.req.query();
  if (Object.keys(query).length > 0) {
    context.query = query;
  }

  if (status === 413) {
    logger.warn("middleware.http.body_too_large", context);
    return;
  }

  if (status >= 500) {
    logger.error("middleware.http.failed", context);
    return;
  }

  if (status >= 400) {
    logger.warn("middleware.http.client_error", context);
    return;
  }

  logger.info("middleware.http.ok", context);
}

export function logMiddleware(options: LogMiddlewareOptions) {
  const { logger } = options;

  return createMiddleware(async (context, next) => {
    const rayId = context.req.raw.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
    context.header(REQUEST_ID_HEADER, rayId);

    const start = performance.now();
    await next();
    log(logger, context, Math.round(performance.now() - start), rayId);
  });
}
