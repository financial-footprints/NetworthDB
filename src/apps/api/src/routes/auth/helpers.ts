import type { AuthEnv } from "@api/config/hono-env";
import { parseRole, type UserListQuery } from "@ndb/core";
import { rateLimit } from "@ndb/middleware";
import type { AdminUserListQuery } from "@ndb/platform";
import type { MiddlewareHandler } from "hono";

export function withRateLimit(): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    await rateLimit(c.get("services").auth)(c, next);
  };
}

export function toUserListQuery(query: AdminUserListQuery): UserListQuery {
  const roleFilter = query["filters.role"];
  return {
    limit: query["pagination.limit"],
    offset: query["pagination.offset"],
    role: roleFilter && roleFilter.length > 0 ? parseRole(roleFilter) : undefined,
    multifactorEnabled: query["filters.multifactor_enabled"],
    search: query.search && query.search.length > 0 ? query.search : undefined,
  };
}

export const jsonMedia = <T extends { parse: (input: unknown) => unknown }>(schema: T) =>
  ({ "application/json": { schema } }) as const;

export const jsonBody = <T extends { parse: (input: unknown) => unknown }>(schema: T) => ({
  content: jsonMedia(schema),
});

export const optionalJsonBody = <T extends { parse: (input: unknown) => unknown }>(schema: T) => ({
  content: jsonMedia(schema),
  required: false,
});
