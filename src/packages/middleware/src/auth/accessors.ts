import type { MultifactorPrincipal, Principal, SessionPrincipal } from "@middleware/auth/types";
import { UnauthorizedError } from "@ndb/core";

export function sessionPrincipal(principal: Principal): SessionPrincipal {
  if (!principal.session || !principal.auth) {
    throw new UnauthorizedError("Session is missing.");
  }

  return {
    user: principal.user,
    session: principal.session,
    auth: principal.auth,
  };
}

export function mfaPrincipal(principal: Principal): MultifactorPrincipal {
  if (!principal.multifactor) {
    throw new UnauthorizedError("Multifactor session is missing.");
  }

  return {
    user: principal.user,
    multifactor: principal.multifactor,
    auth: principal.auth,
  };
}
