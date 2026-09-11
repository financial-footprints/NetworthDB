import { cryptography } from "@database/encryption";
import { applyPagination, applySort } from "@database/repositories/helpers";
import { sources as sourcesTable } from "@database/schema/sources";
import type { DbClient } from "@database/types";
import {
  ONE,
  type Pagination,
  type Sort,
  type SourcesFilters,
  type SourcesRepository,
  type SourcesSortColumn,
  UserSources,
} from "@ndb/core";
import { and, count, eq, type SQL } from "drizzle-orm";

async function fromRow(db: DbClient, row: typeof sourcesTable.$inferSelect): Promise<UserSources> {
  if (!row.sourcesConfig) {
    return UserSources.fromPersisted(row.userId, null, row.createdAt, row.updatedAt);
  }

  const decrypted = await cryptography.decrypt(db, row.userId, row.sourcesConfig);
  const json = JSON.parse(decrypted.toString("utf8")) as unknown;
  return UserSources.fromPersisted(row.userId, json, row.createdAt, row.updatedAt);
}

async function toRow(db: DbClient, record: UserSources) {
  const payload = record.toPayload();
  const sourcesConfig =
    payload.sources.length > 0
      ? await cryptography.encrypt(db, record.userId, Buffer.from(JSON.stringify(payload), "utf8"))
      : null;

  return {
    userId: record.userId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    sourcesConfig,
  };
}

export class DrizzleSourcesRepository implements SourcesRepository {
  constructor(private readonly db: DbClient) {}

  async create(sources: UserSources): Promise<UserSources> {
    const rows = await this.db
      .insert(sourcesTable)
      .values(await toRow(this.db, sources))
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error("database.sources.create.error.no-row");
    }

    return fromRow(this.db, row);
  }

  async findById(userId: string): Promise<UserSources | null> {
    const rows = await this.findByFilters({ userId }, undefined, ONE);
    return rows[0] ?? null;
  }

  async findByFilters(
    filters: SourcesFilters,
    sort?: Sort<SourcesSortColumn>,
    pagination?: Pagination
  ): Promise<UserSources[]> {
    const where = this._filter(filters);
    const orderBy = applySort<SourcesSortColumn>(
      {
        createdAt: sourcesTable.createdAt,
        updatedAt: sourcesTable.updatedAt,
      },
      sort
    );
    let query = this.db.select().from(sourcesTable).$dynamic();
    if (where) {
      query = query.where(where);
    }
    if (orderBy) {
      query = query.orderBy(orderBy);
    }

    const rows = await applyPagination(query, pagination);
    return Promise.all(rows.map((row) => fromRow(this.db, row)));
  }

  async save(sources: UserSources): Promise<UserSources> {
    const existing = await this.findById(sources.userId);
    if (!existing) {
      return this.create(sources);
    }

    const rows = await this.db
      .update(sourcesTable)
      .set(await toRow(this.db, sources))
      .where(eq(sourcesTable.userId, sources.userId))
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error("database.sources.save.error.no-row");
    }

    return fromRow(this.db, row);
  }

  async aggregate(filters: SourcesFilters): Promise<number> {
    const where = this._filter(filters);
    const rows = await this.db.select({ value: count() }).from(sourcesTable).where(where);
    return Number(rows[0]?.value ?? 0);
  }

  async delete(filters: SourcesFilters): Promise<void> {
    const where = this._filter(filters);
    if (!filters.userId) {
      throw new Error("database.sources.delete.invalid.missing-user-id");
    }

    if (where) {
      await this.db.delete(sourcesTable).where(where);
    }
  }

  private _filter(filters: SourcesFilters): SQL | undefined {
    const conditions: SQL[] = [];

    if (filters.userId !== undefined) {
      conditions.push(eq(sourcesTable.userId, filters.userId));
    }

    if (conditions.length === 0) {
      return undefined;
    }

    return and(...conditions);
  }
}
