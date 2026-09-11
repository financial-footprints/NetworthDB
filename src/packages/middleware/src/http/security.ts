import { createMiddleware } from "hono/factory";

const DEFAULT_MAX_BODY_BYTES = 64 * 1024;
const MULTIPART_MAX_BODY_BYTES = 32 * 1024 * 1024;

function maxBodyBytes(contentType: string | undefined): number {
  if (contentType?.includes("multipart/form-data")) {
    return MULTIPART_MAX_BODY_BYTES;
  }
  return DEFAULT_MAX_BODY_BYTES;
}

export function security() {
  return createMiddleware(async (c, next) => {
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Frame-Options", "DENY");

    const contentLength = c.req.header("Content-Length");
    if (contentLength !== undefined) {
      const limit = maxBodyBytes(c.req.header("Content-Type"));
      if (Number(contentLength) > limit) {
        return c.json({ details: "middleware.http.security.body-too-large" }, 413);
      }
    }

    await next();
  });
}
