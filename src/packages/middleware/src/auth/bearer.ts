import { UnauthorizedError } from "@ndb/core";

export function readBearerToken(authHeader: string | undefined): string {
  const match = /^Bearer\s+(\S.*)$/i.exec(authHeader?.trim() ?? "");
  if (!match) {
    throw new UnauthorizedError("Authorization header is missing.");
  }

  const token = match[1]?.trim() ?? "";
  if (token.length === 0) {
    throw new UnauthorizedError("Authorization header is empty.");
  }

  return token;
}
