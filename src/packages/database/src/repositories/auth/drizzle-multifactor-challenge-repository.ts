import { applyPagination, applySort } from "@database/repositories/helpers";
import { authMultifactor } from "@database/schema/auth/multifactor";
import type { DbClient } from "@database/types";
import {
  MultifactorChallenge,
  type MultifactorChallengeFilters,
  type MultifactorChallengeRepository,
  type MultifactorChallengeSortColumn,
  type MultifactorChallengeUpdate,
  ONE,
  type Pagination,
  type Sort,
} from "@ndb/core";
import { and, eq, isNull, type SQL } from "drizzle-orm";

function mapRow(row: typeof authMultifactor.$inferSelect): MultifactorChallenge {
  return new MultifactorChallenge(
    row.id,
    row.userId,
    row.tokenHash,
    row.expiresAt,
    row.createdAt,
    row.usedAt
  );
}

export class DrizzleMultifactorChallengeRepository implements MultifactorChallengeRepository {
  constructor(private readonly db: DbClient) {}

  async create(challenge: MultifactorChallenge): Promise<MultifactorChallenge> {
    const rows = await this.db
      .insert(authMultifactor)
      .values({
        id: challenge.id,
        userId: challenge.userId,
        tokenHash: challenge.tokenHash,
        expiresAt: challenge.expiresAt,
        createdAt: challenge.createdAt,
        usedAt: challenge.usedAt,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error("database.auth.multifactor-challenge.create.error.no-row");
    }

    return mapRow(row);
  }

  async findById(id: string): Promise<MultifactorChallenge | null> {
    const rows = await this.findByFilters({ id }, undefined, ONE);
    return rows[0] ?? null;
  }

  async findByFilters(
    filters: MultifactorChallengeFilters,
    sort?: Sort<MultifactorChallengeSortColumn>,
    pagination?: Pagination
  ): Promise<MultifactorChallenge[]> {
    const where = this._filter(filters);
    const orderBy = applySort<MultifactorChallengeSortColumn>(
      { createdAt: authMultifactor.createdAt, expiresAt: authMultifactor.expiresAt },
      sort
    );
    let query = this.db.select().from(authMultifactor).$dynamic();
    if (where) {
      query = query.where(where);
    }
    if (orderBy) {
      query = query.orderBy(orderBy);
    }
    const rows = await applyPagination(query, pagination);
    return rows.map(mapRow);
  }

  async save(challenge: MultifactorChallenge): Promise<MultifactorChallenge> {
    const rows = await this.db
      .update(authMultifactor)
      .set({
        usedAt: challenge.usedAt,
      })
      .where(eq(authMultifactor.id, challenge.id))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error("database.auth.multifactor-challenge.save.error.no-row");
    }

    return mapRow(row);
  }

  async update(
    filters: MultifactorChallengeFilters,
    patch: MultifactorChallengeUpdate
  ): Promise<MultifactorChallenge[]> {
    const where = this._filter(filters);
    if (!where) {
      return [];
    }

    const rows = await this.db.update(authMultifactor).set(patch).where(where).returning();
    return rows.map(mapRow);
  }

  private _filter(filters: MultifactorChallengeFilters): SQL | undefined {
    const conditions: SQL[] = [];

    if (filters.id !== undefined) {
      conditions.push(eq(authMultifactor.id, filters.id));
    }
    if (filters.userId !== undefined) {
      conditions.push(eq(authMultifactor.userId, filters.userId));
    }
    if (filters.tokenHash !== undefined) {
      conditions.push(eq(authMultifactor.tokenHash, filters.tokenHash));
    }
    if (filters.unused === true) {
      conditions.push(isNull(authMultifactor.usedAt));
    }

    if (conditions.length === 0) {
      return undefined;
    }

    return and(...conditions);
  }
}
