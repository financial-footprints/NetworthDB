import type { ResolvedMultifactorBearer, User } from "@ndb/core";

export type Principal = {
  user: User;
  session?: { id: string };
  auth?: { acr: string; amr: string };
  multifactor?: {
    token: string;
    bearer: ResolvedMultifactorBearer;
  };
};

export type SessionPrincipal = {
  user: User;
  session: { id: string };
  auth: { acr: string; amr: string };
};

export type MultifactorPrincipal = {
  user: User;
  multifactor: { token: string; bearer: ResolvedMultifactorBearer };
  auth?: { acr: string; amr: string };
};
