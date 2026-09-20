import type { AuthService } from "@ndb/core";
import { TooManyRequestsError } from "@ndb/core";
import type { MiddlewareHandler } from "hono";
import { getConnInfo } from "hono/bun";

function clientIp(c: { env: unknown }): string {
  try {
    const info = getConnInfo(c as Parameters<typeof getConnInfo>[0]);
    const address = info.remote.address;
    if (typeof address === "string" && address.length > 0) {
      return address;
    }
  } catch {
    // Unit tests and some fetch adapters have no TCP peer.
  }

  return "unknown";
}

export function rateLimit(auth: Pick<AuthService, "allowRequest">): MiddlewareHandler {
  return async (c, next) => {
    const allowed = await auth.allowRequest(clientIp(c));
    if (!allowed) {
      throw new TooManyRequestsError("Too many requests.");
    }

    await next();
  };
}
