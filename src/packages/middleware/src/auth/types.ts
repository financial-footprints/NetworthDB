import type { PublicUser, ResolvedMultifactorBearer } from "@ndb/core";

export type Principal = {
  user: PublicUser;
  session?: { id: string };
  jwt?: { acr: string; amr: string };
  multifactor?: {
    token: string;
    bearer: ResolvedMultifactorBearer;
  };
};

export type SessionPrincipal = {
  user: PublicUser;
  session: { id: string };
  jwt: { acr: string; amr: string };
};

export type MultifactorPrincipal = {
  user: PublicUser;
  multifactor: { token: string; bearer: ResolvedMultifactorBearer };
  jwt?: { acr: string; amr: string };
};
