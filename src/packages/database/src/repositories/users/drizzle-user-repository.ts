import { applyPagination, applySort, isUniqueViolation } from "@database/repositories/helpers";
import { users } from "@database/schema/users/index";
import type { DbClient } from "@database/types";
import {
  ConflictError,
  DisplayName,
  ONE,
  type Pagination,
  type Sort,
  TotpState,
  User,
  type UserFilters,
  Username,
  type UserRepository,
  type UserSortColumn,
} from "@ndb/core";
import { and, count, eq, ilike, type SQL } from "drizzle-orm";

function mapRow(row: typeof users.$inferSelect): User {
  const totp = new TotpState(
    row.totpConfirmedAt,
    row.totpSecret,
    row.totpPending,
    row.totpLastStep,
    row.multifactorFailedCount,
    row.multifactorLockedUntil
  );

  return new User(
    row.id,
    Username.fromPersisted(row.username),
    row.passwordHash,
    row.role,
    row.multifactorEnabled,
    row.createdAt,
    totp,
    row.recoveryEmailHash,
    row.recoveryEmailSetAt,
    row.displayName ? DisplayName.fromPersisted(row.displayName) : null
  );
}

function userValues(user: User) {
  return {
    id: user.id,
    username: user.username.toString(),
    passwordHash: user.passwordHash,
    role: user.role,
    multifactorEnabled: user.multifactorEnabled,
    createdAt: user.createdAt,
    totpConfirmedAt: user.totp.totpConfirmedAt,
    totpSecret: user.totp.totpSecret,
    totpPending: user.totp.totpPending,
    totpLastStep: user.totp.totpLastStep,
    multifactorFailedCount: user.totp.multifactorFailedCount,
    multifactorLockedUntil: user.totp.multifactorLockedUntil,
    recoveryEmailHash: user.recoveryEmailHash,
    recoveryEmailSetAt: user.recoveryEmailSetAt,
    displayName: user.displayName?.toString() ?? null,
  };
}

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: DbClient) {}

  async create(user: User): Promise<User> {
    try {
      const rows = await this.db.insert(users).values(userValues(user)).returning();
      const row = rows[0];
      if (!row) {
        throw new Error("database.user.create.error.no-row");
      }

      return mapRow(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("Username is already taken.", {
          username: user.username.toString(),
        });
      }

      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    const rows = await this.findByFilters({ id }, undefined, ONE);
    return rows[0] ?? null;
  }

  async findByFilters(
    filters: UserFilters,
    sort?: Sort<UserSortColumn>,
    pagination?: Pagination
  ): Promise<User[]> {
    const where = this._filter(filters);
    const orderBy = applySort<UserSortColumn>(
      { username: users.username, createdAt: users.createdAt },
      sort
    );
    let query = this.db.select().from(users).$dynamic();
    if (where) {
      query = query.where(where);
    }
    if (orderBy) {
      query = query.orderBy(orderBy);
    }
    const rows = await applyPagination(query, pagination);
    return rows.map(mapRow);
  }

  async save(user: User): Promise<User> {
    try {
      const rows = await this.db
        .update(users)
        .set(userValues(user))
        .where(eq(users.id, user.id))
        .returning();
      const row = rows[0];
      if (!row) {
        throw new Error("database.user.save.error.no-row");
      }

      return mapRow(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("Username is already taken.", {
          username: user.username.toString(),
        });
      }

      throw error;
    }
  }

  async aggregate(filters: UserFilters): Promise<number> {
    const where = this._filter(filters);
    const rows = await this.db.select({ value: count() }).from(users).where(where);
    return Number(rows[0]?.value ?? 0);
  }

  async delete(filters: UserFilters): Promise<void> {
    const where = this._filter(filters);
    if (!filters.id) {
      throw new Error("database.user.delete.invalid.missing-id-filter");
    }
    if (where) {
      await this.db.delete(users).where(where);
    }
  }

  async getClientSettings(userId: string): Promise<Record<string, unknown> | null> {
    const rows = await this.db
      .select({ clientSettings: users.clientSettings })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new Error("database.user.client-settings.error.not-found");
    }
    return row.clientSettings ?? null;
  }

  async saveClientSettings(
    userId: string,
    value: Record<string, unknown> | null
  ): Promise<Record<string, unknown> | null> {
    const rows = await this.db
      .update(users)
      .set({ clientSettings: value })
      .where(eq(users.id, userId))
      .returning({ clientSettings: users.clientSettings });
    const row = rows[0];
    if (!row) {
      throw new Error("database.user.client-settings.error.not-found");
    }
    return row.clientSettings ?? null;
  }

  private _filter(filters: UserFilters): SQL | undefined {
    const conditions: SQL[] = [];

    if (filters.id !== undefined) {
      conditions.push(eq(users.id, filters.id));
    }
    if (filters.username !== undefined) {
      conditions.push(eq(users.username, filters.username.toString()));
    }
    if (filters.role !== undefined) {
      conditions.push(eq(users.role, filters.role));
    }
    if (filters.multifactorEnabled !== undefined) {
      conditions.push(eq(users.multifactorEnabled, filters.multifactorEnabled));
    }
    if (filters.search !== undefined && filters.search.length > 0) {
      conditions.push(ilike(users.username, `%${filters.search}%`));
    }

    if (conditions.length === 0) {
      return undefined;
    }

    return and(...conditions);
  }
}
