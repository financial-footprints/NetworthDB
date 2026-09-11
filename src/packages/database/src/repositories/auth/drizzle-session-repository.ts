import { applyPagination, applySort, isUniqueViolation } from "@database/repositories/helpers";
import { authSessions } from "@database/schema/auth/sessions";
import type { DbClient } from "@database/types";
import {
  ConflictError,
  ONE,
  type Pagination,
  Session,
  type SessionFilters,
  type SessionRepository,
  type SessionSortColumn,
  type Sort,
} from "@ndb/core";
import { and, eq, type SQL } from "drizzle-orm";

function mapRow(row: typeof authSessions.$inferSelect): Session {
  return new Session(
    row.id,
    row.userId,
    row.sessionHash,
    row.refreshHash,
    row.sessionExpiresAt,
    row.refreshExpiresAt,
    row.createdAt,
    row.authAmr,
    row.authAcr,
    row.revokedAt
  );
}

export class DrizzleSessionRepository implements SessionRepository {
  constructor(private readonly db: DbClient) {}

  async create(session: Session): Promise<Session> {
    try {
      const rows = await this.db
        .insert(authSessions)
        .values({
          id: session.id,
          userId: session.userId,
          sessionHash: session.sessionHash,
          refreshHash: session.refreshHash,
          sessionExpiresAt: session.sessionExpiresAt,
          refreshExpiresAt: session.refreshExpiresAt,
          createdAt: session.createdAt,
          authAmr: session.authAmr,
          authAcr: session.authAcr,
          revokedAt: session.revokedAt,
        })
        .returning();
      const row = rows[0];
      if (!row) {
        throw new Error("database.auth.session.create.error.no-row");
      }

      return mapRow(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("database.auth.session.create.error.hash-collision");
      }

      throw error;
    }
  }

  async findById(id: string): Promise<Session | null> {
    const rows = await this.findByFilters({ id }, undefined, ONE);
    return rows[0] ?? null;
  }

  async findByFilters(
    filters: SessionFilters,
    sort?: Sort<SessionSortColumn>,
    pagination?: Pagination
  ): Promise<Session[]> {
    const where = this._filter(filters);
    const orderBy = applySort<SessionSortColumn>({ createdAt: authSessions.createdAt }, sort);
    let query = this.db.select().from(authSessions).$dynamic();
    if (where) {
      query = query.where(where);
    }
    if (orderBy) {
      query = query.orderBy(orderBy);
    }
    const rows = await applyPagination(query, pagination);
    return rows.map(mapRow);
  }

  async save(session: Session): Promise<Session> {
    const rows = await this.db
      .update(authSessions)
      .set({
        sessionHash: session.sessionHash,
        refreshHash: session.refreshHash,
        sessionExpiresAt: session.sessionExpiresAt,
        refreshExpiresAt: session.refreshExpiresAt,
        revokedAt: session.revokedAt,
        authAmr: session.authAmr,
        authAcr: session.authAcr,
      })
      .where(eq(authSessions.id, session.id))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error("database.auth.session.save.error.no-row");
    }

    return mapRow(row);
  }

  async delete(filters: SessionFilters): Promise<void> {
    const where = this._filter(filters);
    if (where) {
      await this.db.delete(authSessions).where(where);
    }
  }

  private _filter(filters: SessionFilters): SQL | undefined {
    const conditions: SQL[] = [];

    if (filters.id !== undefined) {
      conditions.push(eq(authSessions.id, filters.id));
    }
    if (filters.userId !== undefined) {
      conditions.push(eq(authSessions.userId, filters.userId));
    }
    if (filters.sessionHash !== undefined) {
      conditions.push(eq(authSessions.sessionHash, filters.sessionHash));
    }
    if (filters.refreshHash !== undefined) {
      conditions.push(eq(authSessions.refreshHash, filters.refreshHash));
    }

    if (conditions.length === 0) {
      return undefined;
    }

    return and(...conditions);
  }
}
