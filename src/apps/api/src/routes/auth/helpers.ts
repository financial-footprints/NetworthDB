import type { AuthEnv } from "@api/config/hono-env";
import { rateLimit } from "@ndb/middleware";
import type { MiddlewareHandler } from "hono";

export function withRateLimit(): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    await rateLimit(c.get("services").authService)(c, next);
  };
}
