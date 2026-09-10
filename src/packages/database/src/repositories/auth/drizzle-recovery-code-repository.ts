import { applyPagination, applySort } from "@database/repositories/helpers";
import { authMultifactorCodes } from "@database/schema/auth/multifactor-codes";
import type { DbClient } from "@database/types";
import {
  type Pagination,
  RecoveryCode,
  type RecoveryCodeFilters,
  type RecoveryCodeRepository,
  type RecoveryCodeSortColumn,
  type RecoveryCodeUpdate,
  type Sort,
} from "@ndb/core";
import { and, count, eq, isNull, type SQL } from "drizzle-orm";

function mapRow(row: typeof authMultifactorCodes.$inferSelect): RecoveryCode {
  return new RecoveryCode(row.id, row.userId, row.codeHash, row.createdAt, row.usedAt);
}

export class DrizzleRecoveryCodeRepository implements RecoveryCodeRepository {
  constructor(private readonly db: DbClient) {}

  async create(codes: RecoveryCode | RecoveryCode[]): Promise<RecoveryCode | RecoveryCode[]> {
    const items = Array.isArray(codes) ? codes : [codes];
    if (items.length === 0) {
      return [];
    }

    const rows = await this.db
      .insert(authMultifactorCodes)
      .values(
        items.map((code) => ({
          id: code.id,
          userId: code.userId,
          codeHash: code.codeHash,
          createdAt: code.createdAt,
          usedAt: code.usedAt,
        }))
      )
      .returning();

    const mapped = rows.map(mapRow);
    if (Array.isArray(codes)) {
      return mapped;
    }

    const created = mapped[0];
    if (!created) {
      throw new Error("database.auth.recovery-code.create.error.no-row");
    }

    return created;
  }

  async findByFilters(
    filters: RecoveryCodeFilters,
    sort?: Sort<RecoveryCodeSortColumn>,
    pagination?: Pagination
  ): Promise<RecoveryCode[]> {
    const where = this._filter(filters);
    const orderBy = applySort<RecoveryCodeSortColumn>(
      { createdAt: authMultifactorCodes.createdAt },
      sort
    );
    let query = this.db.select().from(authMultifactorCodes).$dynamic();
    if (where) {
      query = query.where(where);
    }
    if (orderBy) {
      query = query.orderBy(orderBy);
    }
    const rows = await applyPagination(query, pagination);
    return rows.map(mapRow);
  }

  async save(code: RecoveryCode): Promise<RecoveryCode> {
    const rows = await this.db
      .update(authMultifactorCodes)
      .set({ usedAt: code.usedAt })
      .where(eq(authMultifactorCodes.id, code.id))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error("database.auth.recovery-code.save.error.no-row");
    }

    return mapRow(row);
  }

  async update(filters: RecoveryCodeFilters, patch: RecoveryCodeUpdate): Promise<RecoveryCode[]> {
    const where = this._filter(filters);
    if (!where) {
      return [];
    }

    const rows = await this.db.update(authMultifactorCodes).set(patch).where(where).returning();
    return rows.map(mapRow);
  }

  async aggregate(filters: RecoveryCodeFilters): Promise<number> {
    const where = this._filter(filters);
    const rows = await this.db.select({ value: count() }).from(authMultifactorCodes).where(where);
    return Number(rows[0]?.value ?? 0);
  }

  async delete(filters: RecoveryCodeFilters): Promise<void> {
    const where = this._filter(filters);
    if (where) {
      await this.db.delete(authMultifactorCodes).where(where);
    }
  }

  private _filter(filters: RecoveryCodeFilters): SQL | undefined {
    const conditions: SQL[] = [];

    if (filters.id !== undefined) {
      conditions.push(eq(authMultifactorCodes.id, filters.id));
    }
    if (filters.userId !== undefined) {
      conditions.push(eq(authMultifactorCodes.userId, filters.userId));
    }
    if (filters.codeHash !== undefined) {
      conditions.push(eq(authMultifactorCodes.codeHash, filters.codeHash));
    }
    if (filters.unused === true) {
      conditions.push(isNull(authMultifactorCodes.usedAt));
    }

    if (conditions.length === 0) {
      return undefined;
    }

    return and(...conditions);
  }
}
