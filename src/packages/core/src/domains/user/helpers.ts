import type { User } from "@core/domains/user/entities/user/index";
import type { Role } from "@core/domains/user/roles";
import { ForbiddenError } from "@core/shared/errors/domain-error";

export { ROLES, type Role } from "@core/domains/user/roles";

export function assertAdministrator(user: User): void {
  if (user.role !== "administrator") {
    throw new ForbiddenError("Forbidden");
  }
}

export function assertAdministratorOrManager(user: User): void {
  if (user.role !== "administrator" && user.role !== "manager") {
    throw new ForbiddenError("Forbidden");
  }
}

export type UserListQuery = {
  limit: number;
  offset: number;
  role?: Role;
  multifactorEnabled?: boolean;
  search?: string;
};

export type UserListResult = {
  items: User[];
  total: number;
};
