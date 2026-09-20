import type { Tag } from "@core/domains/account/taxonomy/entities/tag";
import type { Pagination, Sort } from "@core/shared/query";

export type TagFilters = {
  id?: string;
  userId?: string;
  q?: string;
};

export type TagSortColumn = "name";

export interface TagRepository {
  create(tag: Tag): Promise<Tag>;
  save(tag: Tag): Promise<Tag>;
  delete(userId: string, tagId: string): Promise<boolean>;
  findById(userId: string, tagId: string): Promise<Tag | null>;
  findByFilters(
    filters: TagFilters,
    sort?: Sort<TagSortColumn>,
    pagination?: Pagination
  ): Promise<Tag[]>;
  aggregate(filters: TagFilters): Promise<number>;
}
