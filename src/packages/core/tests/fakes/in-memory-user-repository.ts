import type { User } from "@core/domains/user/entities/user/index";
import type {
  UserFilters,
  UserRepository,
  UserSortColumn,
} from "@core/domains/user/repositories/user-repository";
import { ConflictError } from "@core/shared/errors/domain-error";
import type { Pagination, Sort } from "@core/shared/query";
import { paginate, sortByColumn } from "@tests/core/fakes/repository-helpers";

export class InMemoryUserRepository implements UserRepository {
  private readonly byUsername = new Map<string, User>();

  async create(user: User): Promise<User> {
    const key = user.username.toString();
    if (this.byUsername.has(key)) {
      throw new ConflictError("core.user.username.conflict.taken", { username: key });
    }

    this.byUsername.set(key, user);
    return user;
  }

  async findById(id: string): Promise<User | null> {
    for (const user of this.byUsername.values()) {
      if (user.id === id) {
        return user;
      }
    }

    return null;
  }

  async findByFilters(
    filters: UserFilters,
    sort?: Sort<UserSortColumn>,
    pagination?: Pagination
  ): Promise<User[]> {
    let items = [...this.byUsername.values()].filter((user) => this.matches(user, filters));
    items = sortByColumn(
      items,
      {
        username: (user) => user.username.toString(),
        createdAt: (user) => user.createdAt,
      },
      sort
    );
    return paginate(items, pagination);
  }

  async save(user: User): Promise<User> {
    for (const [key, existing] of this.byUsername.entries()) {
      if (existing.id === user.id && key !== user.username.toString()) {
        this.byUsername.delete(key);
      }
    }

    const key = user.username.toString();
    const existing = this.byUsername.get(key);
    if (existing && existing.id !== user.id) {
      throw new ConflictError("core.user.username.conflict.taken", { username: key });
    }

    this.byUsername.set(key, user);
    return user;
  }

  async aggregate(filters: UserFilters): Promise<number> {
    return [...this.byUsername.values()].filter((user) => this.matches(user, filters)).length;
  }

  async delete(filters: UserFilters): Promise<void> {
    for (const [key, user] of this.byUsername.entries()) {
      if (this.matches(user, filters)) {
        this.byUsername.delete(key);
      }
    }
  }

  private matches(user: User, filters: UserFilters): boolean {
    if (filters.id !== undefined && user.id !== filters.id) {
      return false;
    }
    if (
      filters.username !== undefined &&
      user.username.toString() !== filters.username.toString()
    ) {
      return false;
    }
    if (filters.role !== undefined && user.role !== filters.role) {
      return false;
    }
    if (
      filters.multifactorEnabled !== undefined &&
      user.multifactorEnabled !== filters.multifactorEnabled
    ) {
      return false;
    }
    if (filters.search !== undefined && filters.search.length > 0) {
      const needle = filters.search.toLowerCase();
      if (!user.username.toString().toLowerCase().includes(needle)) {
        return false;
      }
    }

    return true;
  }
}
