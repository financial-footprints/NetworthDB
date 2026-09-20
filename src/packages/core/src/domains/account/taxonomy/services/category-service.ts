import { DEFAULT_CATEGORY_TREE } from "@core/domains/account/taxonomy/constants";
import { Category } from "@core/domains/account/taxonomy/entities/category";
import type {
  CategoryFilters,
  CategoryRepository,
} from "@core/domains/account/taxonomy/repositories/category-repository";
import { assertAal2 } from "@core/domains/auth/helpers";
import type { User } from "@core/domains/user/entities/user/index";
import { EntityNotFoundError, ValidationError } from "@core/shared/errors/domain-error";
export type CategoryListQuery = {
  q?: string;
  parentId?: string | null;
  limit: number;
  offset: number;
};

export class CategoryService {
  constructor(private readonly categories: CategoryRepository) {}

  async ensureDefaultCategories(userId: string): Promise<void> {
    const total = await this.categories.aggregate({ userId });
    if (total > 0) {
      return;
    }

    for (const root of DEFAULT_CATEGORY_TREE) {
      const parent = await this.categories.create(
        Category.create({ userId, parentId: null, name: root.name })
      );
      for (const childName of root.children) {
        await this.categories.create(
          Category.create({ userId, parentId: parent.id, name: childName })
        );
      }
    }
  }

  async mapById(userId: string): Promise<Map<string, Category>> {
    const rows = await this.categories.findByFilters({ userId });
    return new Map(rows.map((row) => [row.id, row]));
  }

  async list(
    user: User,
    authAcr: string,
    query: CategoryListQuery
  ): Promise<{ items: Category[]; total: number }> {
    assertAal2(user.multifactorEnabled, authAcr);
    const filters: CategoryFilters = {
      userId: user.id,
      q: query.q,
    };
    if (query.parentId !== undefined) {
      filters.parentId = query.parentId;
    }
    const [items, total] = await Promise.all([
      this.categories.findByFilters(
        filters,
        { column: "name", direction: "asc" },
        { limit: query.limit, offset: query.offset }
      ),
      this.categories.aggregate(filters),
    ]);
    return { items, total };
  }

  async create(
    user: User,
    authAcr: string,
    input: { name: string; parentId: string | null }
  ): Promise<Category> {
    assertAal2(user.multifactorEnabled, authAcr);
    if (input.parentId) {
      const parent = await this.categories.findById(user.id, input.parentId);
      if (!parent) {
        throw new EntityNotFoundError("Category", input.parentId);
      }
      if (parent.parentId !== null) {
        throw new ValidationError("Parent category must be a root category.", {
          field: "parentId",
        });
      }
    }
    const row = Category.create({
      userId: user.id,
      parentId: input.parentId,
      name: input.name,
    });
    return this.categories.create(row);
  }

  async update(
    user: User,
    authAcr: string,
    id: string,
    input: { name: string }
  ): Promise<Category> {
    assertAal2(user.multifactorEnabled, authAcr);
    const existing = await this.categories.findById(user.id, id);
    if (!existing) {
      throw new EntityNotFoundError("Category", id);
    }
    const updated = existing.withName(input.name, new Date().toISOString());
    return this.categories.save(updated);
  }

  async delete(user: User, authAcr: string, id: string): Promise<void> {
    assertAal2(user.multifactorEnabled, authAcr);
    const deleted = await this.categories.delete(user.id, id);
    if (!deleted) {
      throw new EntityNotFoundError("Category", id);
    }
  }
}
