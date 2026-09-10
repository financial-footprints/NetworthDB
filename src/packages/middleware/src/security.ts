import { createMiddleware } from "hono/factory";

const MAX_BODY_BYTES = 64 * 1024;

export function securityMiddleware() {
  return createMiddleware(async (context, next) => {
    context.header("X-Content-Type-Options", "nosniff");
    context.header("Referrer-Policy", "no-referrer");
    context.header("X-Frame-Options", "DENY");

    const contentLength = context.req.header("Content-Length");
    if (contentLength !== undefined && Number(contentLength) > MAX_BODY_BYTES) {
      return context.json({ details: "request body too large" }, 413);
    }

    return await next();
  });
}
