import type { MultifactorPrincipal, Principal, SessionPrincipal } from "@middleware/auth/types";
import { UnauthorizedError } from "@ndb/core";

export function sessionPrincipal(principal: Principal): SessionPrincipal {
  if (!principal.session || !principal.auth) {
    throw new UnauthorizedError("middleware.auth.session.unauthorized.missing");
  }

  return {
    user: principal.user,
    session: principal.session,
    auth: principal.auth,
  };
}

export function mfaPrincipal(principal: Principal): MultifactorPrincipal {
  if (!principal.multifactor) {
    throw new UnauthorizedError("middleware.auth.multifactor.unauthorized.missing");
  }

  return {
    user: principal.user,
    multifactor: principal.multifactor,
    auth: principal.auth,
  };
}
