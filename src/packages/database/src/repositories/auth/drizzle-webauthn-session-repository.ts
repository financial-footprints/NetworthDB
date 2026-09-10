import {
  applyPagination,
  applySort,
  bufferToText,
  textToBuffer,
} from "@database/repositories/helpers";
import { authWebauthn } from "@database/schema/auth/webauthn";
import type { DbClient } from "@database/types";
import {
  ONE,
  type Pagination,
  type Sort,
  WebAuthnSession,
  type WebAuthnSessionFilters,
  type WebAuthnSessionRepository,
  type WebAuthnSessionSortColumn,
} from "@ndb/core";
import { and, eq, type SQL } from "drizzle-orm";

function mapRow(row: typeof authWebauthn.$inferSelect): WebAuthnSession {
  return new WebAuthnSession(
    row.id,
    row.userId,
    textToBuffer<string, Buffer>(row.sessionData, "utf8"),
    row.expiresAt,
    row.createdAt
  );
}

export class DrizzleWebAuthnSessionRepository implements WebAuthnSessionRepository {
  constructor(private readonly db: DbClient) {}

  async create(session: WebAuthnSession): Promise<WebAuthnSession> {
    const rows = await this.db
      .insert(authWebauthn)
      .values({
        id: session.id,
        userId: session.userId,
        sessionData: bufferToText<Buffer, string>(session.sessionData, "utf8"),
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error("database.auth.webauthn-session.create.error.no-row");
    }

    return mapRow(row);
  }

  async findById(id: string): Promise<WebAuthnSession | null> {
    const rows = await this.findByFilters({ id }, undefined, ONE);
    return rows[0] ?? null;
  }

  async findByFilters(
    filters: WebAuthnSessionFilters,
    sort?: Sort<WebAuthnSessionSortColumn>,
    pagination?: Pagination
  ): Promise<WebAuthnSession[]> {
    const where = this._filter(filters);
    const orderBy = applySort<WebAuthnSessionSortColumn>(
      { createdAt: authWebauthn.createdAt, expiresAt: authWebauthn.expiresAt },
      sort
    );
    let query = this.db.select().from(authWebauthn).$dynamic();
    if (where) {
      query = query.where(where);
    }
    if (orderBy) {
      query = query.orderBy(orderBy);
    }
    const rows = await applyPagination(query, pagination);
    return rows.map(mapRow);
  }

  async delete(filters: WebAuthnSessionFilters): Promise<void> {
    const where = this._filter(filters);
    if (where) {
      await this.db.delete(authWebauthn).where(where);
    }
  }

  private _filter(filters: WebAuthnSessionFilters): SQL | undefined {
    const conditions: SQL[] = [];

    if (filters.id !== undefined) {
      conditions.push(eq(authWebauthn.id, filters.id));
    }
    if (filters.userId !== undefined) {
      conditions.push(eq(authWebauthn.userId, filters.userId));
    }

    if (conditions.length === 0) {
      return undefined;
    }

    return and(...conditions);
  }
}
