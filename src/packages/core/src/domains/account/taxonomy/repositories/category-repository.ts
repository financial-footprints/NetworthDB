import type { Category } from "@core/domains/account/taxonomy/entities/category";
import type { Pagination, Sort } from "@core/shared/query";

export type CategoryFilters = {
  id?: string;
  userId?: string;
  parentId?: string | null;
  q?: string;
};

export type CategorySortColumn = "name";

export interface CategoryRepository {
  create(category: Category): Promise<Category>;
  save(category: Category): Promise<Category>;
  delete(userId: string, categoryId: string): Promise<boolean>;
  findById(userId: string, categoryId: string): Promise<Category | null>;
  findByFilters(
    filters: CategoryFilters,
    sort?: Sort<CategorySortColumn>,
    pagination?: Pagination
  ): Promise<Category[]>;
  aggregate(filters: CategoryFilters): Promise<number>;
}
