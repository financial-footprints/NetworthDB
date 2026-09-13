import { readBearerToken } from "@middleware/auth/bearer";
import type { Principal } from "@middleware/auth/types";
import type { AuthService } from "@ndb/core";
import { UnauthorizedError } from "@ndb/core";
import { setRequestActorId } from "@ndb/logger";
import type { Env, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";

export type SessionContext = {
  principal: Principal;
};

export function requireSession<
  E extends Env & { Variables: SessionContext & { services: { auth: AuthService } } },
>(): MiddlewareHandler<E> {
  return createMiddleware<E>(async (c, next) => {
    const token = readBearerToken(c.req.header("Authorization"));
    const bearer = await c.get("services").auth.multifactor.resolve(token);
    if (bearer.kind !== "session") {
      throw new UnauthorizedError("middleware.auth.session.unauthorized.missing");
    }

    c.set("principal", {
      user: bearer.user,
      session: { id: bearer.sessionId },
      auth: { acr: bearer.authAcr, amr: bearer.authAmr },
    });
    setRequestActorId(bearer.user.id);
    await next();
  });
}
