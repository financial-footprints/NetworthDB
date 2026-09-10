import { applyPagination, applySort } from "@database/repositories/helpers";
import { authRecovery } from "@database/schema/auth/recovery";
import type { DbClient } from "@database/types";
import {
  type Pagination,
  RecoveryChallenge,
  type RecoveryChallengeFilters,
  type RecoveryChallengeRepository,
  type RecoveryChallengeSortColumn,
  type RecoveryChallengeUpdate,
  type Sort,
} from "@ndb/core";
import { and, eq, gt, isNull, type SQL } from "drizzle-orm";

function mapRow(row: typeof authRecovery.$inferSelect): RecoveryChallenge {
  return new RecoveryChallenge(
    row.id,
    row.userId,
    row.kind,
    row.secretHash,
    row.expiresAt,
    row.createdAt,
    row.usedAt
  );
}

export class DrizzleRecoveryChallengeRepository implements RecoveryChallengeRepository {
  constructor(private readonly db: DbClient) {}

  async create(challenge: RecoveryChallenge): Promise<RecoveryChallenge> {
    const rows = await this.db
      .insert(authRecovery)
      .values({
        id: challenge.id,
        userId: challenge.userId,
        kind: challenge.kind,
        secretHash: challenge.secretHash,
        expiresAt: challenge.expiresAt,
        createdAt: challenge.createdAt,
        usedAt: challenge.usedAt,
      })
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error("database.auth.recovery-challenge.create.error.no-row");
    }

    return mapRow(row);
  }

  async findByFilters(
    filters: RecoveryChallengeFilters,
    sort?: Sort<RecoveryChallengeSortColumn>,
    pagination?: Pagination
  ): Promise<RecoveryChallenge[]> {
    const where = this._filter(filters);
    const orderBy = applySort<RecoveryChallengeSortColumn>(
      { createdAt: authRecovery.createdAt, expiresAt: authRecovery.expiresAt },
      sort
    );
    let query = this.db.select().from(authRecovery).$dynamic();
    if (where) {
      query = query.where(where);
    }
    if (orderBy) {
      query = query.orderBy(orderBy);
    }
    const rows = await applyPagination(query, pagination);
    return rows.map(mapRow);
  }

  async update(
    filters: RecoveryChallengeFilters,
    patch: RecoveryChallengeUpdate
  ): Promise<RecoveryChallenge[]> {
    const where = this._filter(filters);
    if (!where) {
      return [];
    }

    const rows = await this.db.update(authRecovery).set(patch).where(where).returning();
    return rows.map(mapRow);
  }

  private _filter(filters: RecoveryChallengeFilters): SQL | undefined {
    const conditions: SQL[] = [];

    if (filters.id !== undefined) {
      conditions.push(eq(authRecovery.id, filters.id));
    }
    if (filters.userId !== undefined) {
      conditions.push(eq(authRecovery.userId, filters.userId));
    }
    if (filters.kind !== undefined) {
      conditions.push(eq(authRecovery.kind, filters.kind));
    }
    if (filters.secretHash !== undefined) {
      conditions.push(eq(authRecovery.secretHash, filters.secretHash));
    }
    if (filters.active === true) {
      const now = new Date();
      conditions.push(isNull(authRecovery.usedAt));
      conditions.push(gt(authRecovery.expiresAt, now));
    }

    if (conditions.length === 0) {
      return undefined;
    }

    return and(...conditions);
  }
}
