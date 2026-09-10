import type { User, Username } from "@core/domains/user/entities/user/index";
import type { Role } from "@core/domains/user/helpers";
import type { Pagination, Sort } from "@core/shared/query";

export type UserFilters = {
  id?: string;
  username?: Username;
  role?: Role;
  multifactorEnabled?: boolean;
  search?: string;
};

export type UserSortColumn = "username" | "createdAt";

export interface UserRepository {
  create(user: User): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByFilters(
    filters: UserFilters,
    sort?: Sort<UserSortColumn>,
    pagination?: Pagination
  ): Promise<User[]>;
  save(user: User): Promise<User>;
  aggregate(filters: UserFilters): Promise<number>;
  delete(filters: UserFilters): Promise<void>;
}
