import type { UserSources } from "@core/domains/sources/entities/sources";
import type { Pagination, Sort } from "@core/shared/query";

export type SourcesFilters = {
  userId?: string;
};

export type SourcesSortColumn = "createdAt" | "updatedAt";

export interface SourcesRepository {
  create(sources: UserSources): Promise<UserSources>;
  findById(userId: string): Promise<UserSources | null>;
  findByFilters(
    filters: SourcesFilters,
    sort?: Sort<SourcesSortColumn>,
    pagination?: Pagination
  ): Promise<UserSources[]>;
  save(sources: UserSources): Promise<UserSources>;
  aggregate(filters: SourcesFilters): Promise<number>;
  delete(filters: SourcesFilters): Promise<void>;
}
