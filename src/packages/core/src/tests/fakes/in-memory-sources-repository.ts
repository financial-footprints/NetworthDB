import type { UserSources } from "@core/domains/sources/entities/sources";
import type {
  SourcesFilters,
  SourcesRepository,
  SourcesSortColumn,
} from "@core/domains/sources/repositories/sources-repository";
import type { Pagination, Sort } from "@core/shared/query";

export class InMemorySourcesRepository implements SourcesRepository {
  private readonly byUserId = new Map<string, UserSources>();

  async create(sources: UserSources): Promise<UserSources> {
    this.byUserId.set(sources.userId, sources);
    return sources;
  }

  async findById(userId: string): Promise<UserSources | null> {
    const rows = await this.findByFilters({ userId });
    return rows[0] ?? null;
  }

  async findByFilters(
    filters: SourcesFilters,
    sort?: Sort<SourcesSortColumn>,
    pagination?: Pagination
  ): Promise<UserSources[]> {
    let rows = [...this.byUserId.values()].filter((item) => this.matchesFilters(item, filters));

    if (sort) {
      rows.sort((a, b) => {
        const left = sort.column === "createdAt" ? a.createdAt.getTime() : a.updatedAt.getTime();
        const right = sort.column === "createdAt" ? b.createdAt.getTime() : b.updatedAt.getTime();
        return sort.direction === "desc" ? right - left : left - right;
      });
    }

    if (pagination) {
      rows = rows.slice(pagination.offset, pagination.offset + pagination.limit);
    }

    return rows;
  }

  async save(sources: UserSources): Promise<UserSources> {
    this.byUserId.set(sources.userId, sources);
    return sources;
  }

  async aggregate(filters: SourcesFilters): Promise<number> {
    return [...this.byUserId.values()].filter((item) => this.matchesFilters(item, filters)).length;
  }

  async delete(filters: SourcesFilters): Promise<void> {
    if (!filters.userId) {
      throw new Error("database.sources.delete.invalid.missing-user-id");
    }

    this.byUserId.delete(filters.userId);
  }

  private matchesFilters(item: UserSources, filters: SourcesFilters): boolean {
    if (filters.userId !== undefined && item.userId !== filters.userId) {
      return false;
    }

    return true;
  }
}
