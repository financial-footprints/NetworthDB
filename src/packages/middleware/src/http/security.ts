import { createMiddleware } from "hono/factory";

const MAX_BODY_BYTES = 64 * 1024;

export function security() {
  return createMiddleware(async (c, next) => {
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Frame-Options", "DENY");

    const contentLength = c.req.header("Content-Length");
    if (contentLength !== undefined && Number(contentLength) > MAX_BODY_BYTES) {
      return c.json({ details: "middleware.http.security.body-too-large" }, 413);
    }

    await next();
  });
}
