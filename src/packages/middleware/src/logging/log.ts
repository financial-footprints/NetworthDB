import type { Logger } from "@ndb/logger";
import { runWithRequestContext } from "@ndb/logger";
import { REQUEST_ID_HEADER } from "@ndb/platform";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

function writeRequestLog(logger: Logger, c: Context, durationMs: number): void {
  const status = c.res.status;
  const context: Record<string, unknown> = {
    method: c.req.method,
    path: c.req.path,
    status,
    durationMs,
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

export function requestLog(logger: Logger) {
  return createMiddleware(async (c, next) => {
    const rayId = c.req.raw.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
    c.header(REQUEST_ID_HEADER, rayId);

    const start = performance.now();
    await runWithRequestContext(
      rayId,
      async () => await next(),
    );
    writeRequestLog(logger, c, Math.round(performance.now() - start));
  });
}
