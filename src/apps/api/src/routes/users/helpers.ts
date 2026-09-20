import type { UserListQuery } from "@ndb/core";
import type { AdminUserListQuery } from "@ndb/platform";

export function toUserListQuery(query: AdminUserListQuery): UserListQuery {
  return {
    limit: query.limit,
    offset: query.offset,
    role: query.role,
    multifactorEnabled: query.multifactorEnabled,
    search: query.search && query.search.length > 0 ? query.search : undefined,
  };
}
