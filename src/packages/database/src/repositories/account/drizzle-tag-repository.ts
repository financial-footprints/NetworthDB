import {
  applyPagination,
  applySort,
  escapeLikePattern,
  isUniqueViolation,
} from "@database/repositories/helpers";
import { transactionTags } from "@database/schema/transactions/tags";
import type { DbClient } from "@database/types";
import {
  ConflictError,
  type Pagination,
  type Sort,
  Tag,
  type TagFilters,
  type TagRepository,
  type TagSortColumn,
} from "@ndb/core";
import { and, count, eq, ilike, type SQL } from "drizzle-orm";

function mapTag(row: typeof transactionTags.$inferSelect): Tag {
  return new Tag(
    row.id,
    row.userId,
    row.name,
    row.createdAt.toISOString(),
    row.updatedAt.toISOString()
  );
}

function tagValues(tag: Tag) {
  return {
    id: tag.id,
    userId: tag.userId,
    name: tag.name,
    createdAt: new Date(tag.createdAt),
    updatedAt: new Date(tag.updatedAt),
  };
}

function tagWhere(filters: TagFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (filters.id) {
    parts.push(eq(transactionTags.id, filters.id));
  }
  if (filters.userId) {
    parts.push(eq(transactionTags.userId, filters.userId));
  }
  if (filters.q) {
    parts.push(ilike(transactionTags.name, `%${escapeLikePattern(filters.q)}%`));
  }
  return parts.length > 0 ? and(...parts) : undefined;
}

export class DrizzleTagRepository implements TagRepository {
  constructor(private readonly db: DbClient) {}

  async create(tag: Tag): Promise<Tag> {
    try {
      const rows = await this.db.insert(transactionTags).values(tagValues(tag)).returning();
      const row = rows[0];
      if (!row) {
        throw new Error("database.tag.create.error.no-row");
      }
      return mapTag(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("Name is already taken.");
      }
      throw error;
    }
  }

  async save(tag: Tag): Promise<Tag> {
    try {
      const rows = await this.db
        .update(transactionTags)
        .set({
          name: tag.name,
          updatedAt: new Date(tag.updatedAt),
        })
        .where(and(eq(transactionTags.id, tag.id), eq(transactionTags.userId, tag.userId)))
        .returning();
      const row = rows[0];
      if (!row) {
        throw new Error("database.tag.save.error.no-row");
      }
      return mapTag(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("Name is already taken.");
      }
      throw error;
    }
  }

  async delete(userId: string, tagId: string): Promise<boolean> {
    const rows = await this.db
      .delete(transactionTags)
      .where(and(eq(transactionTags.id, tagId), eq(transactionTags.userId, userId)))
      .returning({ id: transactionTags.id });
    return rows.length > 0;
  }

  async findById(userId: string, tagId: string): Promise<Tag | null> {
    const rows = await this.db
      .select()
      .from(transactionTags)
      .where(and(eq(transactionTags.id, tagId), eq(transactionTags.userId, userId)))
      .limit(1);
    const row = rows[0];
    return row ? mapTag(row) : null;
  }

  async findByFilters(
    filters: TagFilters,
    sort?: Sort<TagSortColumn>,
    pagination?: Pagination
  ): Promise<Tag[]> {
    const where = tagWhere(filters);
    let query = this.db.select().from(transactionTags);
    if (where) {
      query = query.where(where) as typeof query;
    }
    const order = applySort({ name: transactionTags.name }, sort);
    if (order) {
      query = query.orderBy(order) as typeof query;
    }
    const rows = await applyPagination(query, pagination);
    return rows.map(mapTag);
  }

  async aggregate(filters: TagFilters): Promise<number> {
    const where = tagWhere(filters);
    let query = this.db.select({ value: count() }).from(transactionTags);
    if (where) {
      query = query.where(where) as typeof query;
    }
    const rows = await query;
    return Number(rows[0]?.value ?? 0);
  }
}
