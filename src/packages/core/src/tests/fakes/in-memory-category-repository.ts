import type { Category } from "@core/domains/account/taxonomy/entities/category";
import type {
  CategoryFilters,
  CategoryRepository,
  CategorySortColumn,
} from "@core/domains/account/taxonomy/repositories/category-repository";
import { ConflictError } from "@core/shared/errors/domain-error";
import type { Pagination, Sort } from "@core/shared/query";
import { paginate, sortByColumn } from "@core/tests/fakes/repository-helpers";

export class InMemoryCategoryRepository implements CategoryRepository {
  private readonly byId = new Map<string, Category>();

  private nameKey(userId: string, parentId: string | null, name: string): string {
    return `${userId}:${parentId ?? "root"}:${name.toLowerCase()}`;
  }

  private assertUnique(category: Category): void {
    for (const existing of this.byId.values()) {
      if (existing.id === category.id) {
        continue;
      }
      if (
        this.nameKey(existing.userId, existing.parentId, existing.name) ===
        this.nameKey(category.userId, category.parentId, category.name)
      ) {
        throw new ConflictError("Name is already taken.");
      }
    }
  }

  async create(category: Category): Promise<Category> {
    this.assertUnique(category);
    this.byId.set(category.id, category);
    return category;
  }

  async save(category: Category): Promise<Category> {
    this.assertUnique(category);
    this.byId.set(category.id, category);
    return category;
  }

  async delete(userId: string, categoryId: string): Promise<boolean> {
    const existing = this.byId.get(categoryId);
    if (!existing || existing.userId !== userId) {
      return false;
    }
    this.byId.delete(categoryId);
    for (const [id, row] of this.byId.entries()) {
      if (row.parentId === categoryId) {
        this.byId.delete(id);
      }
    }
    return true;
  }

  async findById(userId: string, categoryId: string): Promise<Category | null> {
    const row = this.byId.get(categoryId);
    if (!row || row.userId !== userId) {
      return null;
    }
    return row;
  }

  async findByFilters(
    filters: CategoryFilters,
    sort?: Sort<CategorySortColumn>,
    pagination?: Pagination
  ): Promise<Category[]> {
    let items = [...this.byId.values()].filter((row) => this.matches(row, filters));
    items = sortByColumn(items, { name: (row) => row.name }, sort);
    return paginate(items, pagination);
  }

  async aggregate(filters: CategoryFilters): Promise<number> {
    return (await this.findByFilters(filters)).length;
  }

  private matches(row: Category, filters: CategoryFilters): boolean {
    if (filters.id && row.id !== filters.id) {
      return false;
    }
    if (filters.userId && row.userId !== filters.userId) {
      return false;
    }
    if (filters.parentId !== undefined) {
      if (filters.parentId === null && row.parentId !== null) {
        return false;
      }
      if (filters.parentId !== null && row.parentId !== filters.parentId) {
        return false;
      }
    }
    if (filters.q && !row.name.toLowerCase().includes(filters.q.toLowerCase())) {
      return false;
    }
    return true;
  }
}
