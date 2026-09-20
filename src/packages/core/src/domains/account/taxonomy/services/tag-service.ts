import { Tag } from "@core/domains/account/taxonomy/entities/tag";
import type {
  TagFilters,
  TagRepository,
} from "@core/domains/account/taxonomy/repositories/tag-repository";
import { assertAal2 } from "@core/domains/auth/helpers";
import type { User } from "@core/domains/user/entities/user/index";
import { EntityNotFoundError } from "@core/shared/errors/domain-error";

export type TagListQuery = {
  q?: string;
  limit: number;
  offset: number;
};

export class TagService {
  constructor(private readonly tags: TagRepository) {}

  async mapById(userId: string): Promise<Map<string, Tag>> {
    const rows = await this.tags.findByFilters({ userId });
    return new Map(rows.map((row) => [row.id, row]));
  }

  async list(
    user: User,
    authAcr: string,
    query: TagListQuery
  ): Promise<{ items: Tag[]; total: number }> {
    assertAal2(user.multifactorEnabled, authAcr);
    const filters: TagFilters = { userId: user.id, q: query.q };
    const [items, total] = await Promise.all([
      this.tags.findByFilters(
        filters,
        { column: "name", direction: "asc" },
        { limit: query.limit, offset: query.offset }
      ),
      this.tags.aggregate(filters),
    ]);
    return { items, total };
  }

  async create(user: User, authAcr: string, input: { name: string }): Promise<Tag> {
    assertAal2(user.multifactorEnabled, authAcr);
    const row = Tag.create({ userId: user.id, name: input.name });
    return this.tags.create(row);
  }

  async update(user: User, authAcr: string, id: string, input: { name: string }): Promise<Tag> {
    assertAal2(user.multifactorEnabled, authAcr);
    const existing = await this.tags.findById(user.id, id);
    if (!existing) {
      throw new EntityNotFoundError("Tag", id);
    }
    const updated = existing.withName(input.name, new Date().toISOString());
    return this.tags.save(updated);
  }

  async delete(user: User, authAcr: string, id: string): Promise<void> {
    assertAal2(user.multifactorEnabled, authAcr);
    const deleted = await this.tags.delete(user.id, id);
    if (!deleted) {
      throw new EntityNotFoundError("Tag", id);
    }
  }
}
