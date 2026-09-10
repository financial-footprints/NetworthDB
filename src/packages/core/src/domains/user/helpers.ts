import type { PublicUser } from "@core/domains/user/entities/public-user";
import { ForbiddenError, ValidationError } from "@core/shared/errors/domain-error";

export const ROLES = ["user", "manager", "administrator"] as const;

export type Role = (typeof ROLES)[number];

export function parseRole(raw: string): Role {
  if (raw === "user" || raw === "manager" || raw === "administrator") {
    return raw;
  }

  throw new ValidationError("core.user.role.invalid.unknown", { field: "role", value: raw });
}

export function assertAdministrator(actor: PublicUser): void {
  if (actor.role !== "administrator") {
    throw new ForbiddenError("core.user.authorization.forbidden.insufficient-admin");
  }
}

export function assertAdministratorOrManager(actor: PublicUser): void {
  if (actor.role !== "administrator" && actor.role !== "manager") {
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
  items: PublicUser[];
  total: number;
};
