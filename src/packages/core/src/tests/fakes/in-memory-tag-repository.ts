import type { Tag } from "@core/domains/account/taxonomy/entities/tag";
import type {
  TagFilters,
  TagRepository,
  TagSortColumn,
} from "@core/domains/account/taxonomy/repositories/tag-repository";
import { ConflictError } from "@core/shared/errors/domain-error";
import type { Pagination, Sort } from "@core/shared/query";
import { paginate, sortByColumn } from "@core/tests/fakes/repository-helpers";

export class InMemoryTagRepository implements TagRepository {
  private readonly byId = new Map<string, Tag>();

  private nameKey(userId: string, name: string): string {
    return `${userId}:${name.toLowerCase()}`;
  }

  private assertUnique(tag: Tag): void {
    for (const existing of this.byId.values()) {
      if (existing.id === tag.id) {
        continue;
      }
      if (this.nameKey(existing.userId, existing.name) === this.nameKey(tag.userId, tag.name)) {
        throw new ConflictError("Name is already taken.");
      }
    }
  }

  async create(tag: Tag): Promise<Tag> {
    this.assertUnique(tag);
    this.byId.set(tag.id, tag);
    return tag;
  }

  async save(tag: Tag): Promise<Tag> {
    this.assertUnique(tag);
    this.byId.set(tag.id, tag);
    return tag;
  }

  async delete(userId: string, tagId: string): Promise<boolean> {
    const existing = this.byId.get(tagId);
    if (!existing || existing.userId !== userId) {
      return false;
    }
    this.byId.delete(tagId);
    return true;
  }

  async findById(userId: string, tagId: string): Promise<Tag | null> {
    const row = this.byId.get(tagId);
    if (!row || row.userId !== userId) {
      return null;
    }
    return row;
  }

  async findByFilters(
    filters: TagFilters,
    sort?: Sort<TagSortColumn>,
    pagination?: Pagination
  ): Promise<Tag[]> {
    let items = [...this.byId.values()].filter((row) => this.matches(row, filters));
    items = sortByColumn(items, { name: (row) => row.name }, sort);
    return paginate(items, pagination);
  }

  async aggregate(filters: TagFilters): Promise<number> {
    return (await this.findByFilters(filters)).length;
  }

  private matches(row: Tag, filters: TagFilters): boolean {
    if (filters.id && row.id !== filters.id) {
      return false;
    }
    if (filters.userId && row.userId !== filters.userId) {
      return false;
    }
    if (filters.q && !row.name.toLowerCase().includes(filters.q.toLowerCase())) {
      return false;
    }
    return true;
  }
}
