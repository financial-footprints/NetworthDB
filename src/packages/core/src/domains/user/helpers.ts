import type { User } from "@core/domains/user/entities/user/index";
import { ForbiddenError } from "@core/shared/errors/domain-error";

export const ROLES = ["user", "manager", "administrator"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function assertAdministrator(user: User): void {
  if (user.role !== "administrator") {
    throw new ForbiddenError("core.user.authorization.forbidden.insufficient-admin");
  }
}

export function assertAdministratorOrManager(user: User): void {
  if (user.role !== "administrator" && user.role !== "manager") {
    throw new ForbiddenError("core.user.authorization.forbidden.insufficient-permissions");
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
