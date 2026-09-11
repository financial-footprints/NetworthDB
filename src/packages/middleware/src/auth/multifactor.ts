import { readBearerToken } from "@middleware/auth/bearer";
import type { Principal } from "@middleware/auth/types";
import type { MultifactorService, ResolvedMultifactorBearer } from "@ndb/core";
import { UnauthorizedError } from "@ndb/core";
import type { Env, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";

export type MultifactorContext = {
  principal: Principal;
};

function bearerPrincipal(token: string, bearer: ResolvedMultifactorBearer): Principal {
  const user = bearer.user;
  const multifactor = { token, bearer };

  if (bearer.kind === "session") {
    return { user, auth: { acr: bearer.authAcr, amr: bearer.authAmr }, multifactor };
  }

  return { user, multifactor };
}

export function requireMultifactor<
  E extends Env & {
    Variables: MultifactorContext & { services: { auth: { multifactor: MultifactorService } } };
  },
>(): MiddlewareHandler<E> {
  return createMiddleware<E>(async (c, next) => {
    const token = readBearerToken(c.req.header("Authorization"));
    const bearer = await c.get("services").auth.multifactor.resolve(token);
    c.set("principal", bearerPrincipal(token, bearer));
    await next();
  });
}

export function requireMultifactorChallenge<
  E extends Env & {
    Variables: MultifactorContext & { services: { auth: { multifactor: MultifactorService } } };
  },
>(): MiddlewareHandler<E> {
  return createMiddleware<E>(async (c, next) => {
    const token = readBearerToken(c.req.header("Authorization"));
    const bearer = await c.get("services").auth.multifactor.resolve(token);
    if (bearer.kind !== "challenge") {
      throw new UnauthorizedError("middleware.auth.multifactor.bearer-not-challenge");
    }

    c.set("principal", bearerPrincipal(token, bearer));
    await next();
  });
}
