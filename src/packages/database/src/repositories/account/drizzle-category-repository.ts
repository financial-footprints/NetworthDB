import {
  applyPagination,
  applySort,
  escapeLikePattern,
  isUniqueViolation,
} from "@database/repositories/helpers";
import { transactionCategories } from "@database/schema/transactions/categories";
import type { DbClient } from "@database/types";
import {
  Category,
  type CategoryFilters,
  type CategoryRepository,
  type CategorySortColumn,
  ConflictError,
  type Pagination,
  type Sort,
} from "@ndb/core";
import { and, count, eq, ilike, isNull, type SQL } from "drizzle-orm";

function mapCategory(row: typeof transactionCategories.$inferSelect): Category {
  return new Category(
    row.id,
    row.userId,
    row.parentId,
    row.name,
    row.createdAt.toISOString(),
    row.updatedAt.toISOString()
  );
}

function categoryValues(category: Category) {
  return {
    id: category.id,
    userId: category.userId,
    parentId: category.parentId,
    name: category.name,
    createdAt: new Date(category.createdAt),
    updatedAt: new Date(category.updatedAt),
  };
}

function categoryWhere(filters: CategoryFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (filters.id) {
    parts.push(eq(transactionCategories.id, filters.id));
  }
  if (filters.userId) {
    parts.push(eq(transactionCategories.userId, filters.userId));
  }
  if (filters.parentId !== undefined) {
    if (filters.parentId === null) {
      parts.push(isNull(transactionCategories.parentId));
    } else {
      parts.push(eq(transactionCategories.parentId, filters.parentId));
    }
  }
  if (filters.q) {
    parts.push(ilike(transactionCategories.name, `%${escapeLikePattern(filters.q)}%`));
  }
  return parts.length > 0 ? and(...parts) : undefined;
}

export class DrizzleCategoryRepository implements CategoryRepository {
  constructor(private readonly db: DbClient) {}

  async create(category: Category): Promise<Category> {
    try {
      const rows = await this.db
        .insert(transactionCategories)
        .values(categoryValues(category))
        .returning();
      const row = rows[0];
      if (!row) {
        throw new Error("database.category.create.error.no-row");
      }
      return mapCategory(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("Name is already taken.");
      }
      throw error;
    }
  }

  async save(category: Category): Promise<Category> {
    try {
      const rows = await this.db
        .update(transactionCategories)
        .set({
          name: category.name,
          updatedAt: new Date(category.updatedAt),
        })
        .where(
          and(
            eq(transactionCategories.id, category.id),
            eq(transactionCategories.userId, category.userId)
          )
        )
        .returning();
      const row = rows[0];
      if (!row) {
        throw new Error("database.category.save.error.no-row");
      }
      return mapCategory(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("Name is already taken.");
      }
      throw error;
    }
  }

  async delete(userId: string, categoryId: string): Promise<boolean> {
    const rows = await this.db
      .delete(transactionCategories)
      .where(
        and(eq(transactionCategories.id, categoryId), eq(transactionCategories.userId, userId))
      )
      .returning({ id: transactionCategories.id });
    return rows.length > 0;
  }

  async findById(userId: string, categoryId: string): Promise<Category | null> {
    const rows = await this.db
      .select()
      .from(transactionCategories)
      .where(
        and(eq(transactionCategories.id, categoryId), eq(transactionCategories.userId, userId))
      )
      .limit(1);
    const row = rows[0];
    return row ? mapCategory(row) : null;
  }

  async findByFilters(
    filters: CategoryFilters,
    sort?: Sort<CategorySortColumn>,
    pagination?: Pagination
  ): Promise<Category[]> {
    const where = categoryWhere(filters);
    let query = this.db.select().from(transactionCategories);
    if (where) {
      query = query.where(where) as typeof query;
    }
    const order = applySort({ name: transactionCategories.name }, sort);
    if (order) {
      query = query.orderBy(order) as typeof query;
    }
    const rows = await applyPagination(query, pagination);
    return rows.map(mapCategory);
  }

  async aggregate(filters: CategoryFilters): Promise<number> {
    const where = categoryWhere(filters);
    let query = this.db.select({ value: count() }).from(transactionCategories);
    if (where) {
      query = query.where(where) as typeof query;
    }
    const rows = await query;
    return Number(rows[0]?.value ?? 0);
  }
}
