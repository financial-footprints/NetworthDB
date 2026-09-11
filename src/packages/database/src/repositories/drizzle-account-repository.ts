import { cryptography } from "@database/encryption";
import { applyPagination, applySort, isUniqueViolation } from "@database/repositories/helpers";
import { accounts } from "@database/schema/accounts";
import type { DbClient } from "@database/types";
import {
  Account,
  type AccountFilters,
  type AccountRepository,
  type AccountSortColumn,
  ConflictError,
  type MailRules,
  ONE,
  type Pagination,
  type Sort,
  type StatementRules,
} from "@ndb/core";
import { and, count, eq, type SQL } from "drizzle-orm";

type AccountSecrets = {
  passwords: string[];
  mail: MailRules | null;
  statement: StatementRules | null;
};

function toSecrets(account: Account): AccountSecrets {
  return {
    passwords: account.passwords,
    mail: account.mail,
    statement: account.statement,
  };
}

function toRow(account: Account, blob: Buffer) {
  return {
    id: account.id,
    userId: account.userId,
    accountType: account.accountType,
    bank: account.bank,
    variant: account.variant,
    label: account.label,
    openingDate: account.openingDate,
    closingDate: account.closingDate,
    accountNumber: account.accountNumber,
    secrets: blob,
    createdAt: new Date(account.createdAt),
    updatedAt: new Date(account.updatedAt),
  };
}

async function mapRow(db: DbClient, row: typeof accounts.$inferSelect): Promise<Account> {
  const raw = (await cryptography.decrypt(db, row.userId, row.secrets)).toString("utf8");
  const secrets = JSON.parse(raw) as AccountSecrets;

  return new Account(
    row.id,
    row.userId,
    row.accountType,
    row.bank,
    row.variant,
    row.label,
    row.openingDate,
    row.closingDate,
    row.accountNumber,
    secrets.passwords,
    secrets.mail,
    secrets.statement,
    row.createdAt.toISOString(),
    row.updatedAt.toISOString()
  );
}

export class DrizzleAccountRepository implements AccountRepository {
  constructor(private readonly db: DbClient) {}

  async create(account: Account): Promise<Account> {
    try {
      const secretsBlob = await cryptography.encrypt(
        this.db,
        account.userId,
        Buffer.from(JSON.stringify(toSecrets(account)), "utf8")
      );
      const rows = await this.db.insert(accounts).values(toRow(account, secretsBlob)).returning();
      const row = rows[0];
      if (!row) {
        throw new Error("database.account.create.error.no-row");
      }

      return mapRow(this.db, row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("database.account.create.conflict.id-taken", {
          id: account.id,
        });
      }

      throw error;
    }
  }

  async findById(userId: string, accountId: string): Promise<Account | null> {
    const rows = await this.findByFilters({ id: accountId, userId }, undefined, ONE);
    return rows[0] ?? null;
  }

  async findByFilters(
    filters: AccountFilters,
    sort?: Sort<AccountSortColumn>,
    pagination?: Pagination
  ): Promise<Account[]> {
    const where = this._filter(filters);
    const orderBy = applySort<AccountSortColumn>(
      { createdAt: accounts.createdAt, label: accounts.label },
      sort
    );
    let query = this.db.select().from(accounts).$dynamic();
    if (where) {
      query = query.where(where);
    }
    if (orderBy) {
      query = query.orderBy(orderBy);
    }

    const rows = await applyPagination(query, pagination);
    return Promise.all(rows.map((row) => mapRow(this.db, row)));
  }

  async save(account: Account): Promise<Account> {
    const secretsBlob = await cryptography.encrypt(
      this.db,
      account.userId,
      Buffer.from(JSON.stringify(toSecrets(account)), "utf8")
    );

    const rows = await this.db
      .update(accounts)
      .set(toRow(account, secretsBlob))
      .where(and(eq(accounts.id, account.id), eq(accounts.userId, account.userId)))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error("database.account.save.error.no-row");
    }

    return mapRow(this.db, row);
  }

  async aggregate(filters: AccountFilters): Promise<number> {
    const where = this._filter(filters);
    const rows = await this.db.select({ value: count() }).from(accounts).where(where);
    return Number(rows[0]?.value ?? 0);
  }

  async delete(filters: AccountFilters): Promise<void> {
    const where = this._filter(filters);
    if (!filters.id || !filters.userId) {
      throw new Error("database.account.delete.invalid.missing-filters");
    }

    if (where) {
      await this.db.delete(accounts).where(where);
    }
  }

  private _filter(filters: AccountFilters): SQL | undefined {
    const conditions: SQL[] = [];

    if (filters.id !== undefined) {
      conditions.push(eq(accounts.id, filters.id));
    }
    if (filters.userId !== undefined) {
      conditions.push(eq(accounts.userId, filters.userId));
    }
    if (filters.accountType !== undefined) {
      conditions.push(eq(accounts.accountType, filters.accountType));
    }

    if (conditions.length === 0) {
      return undefined;
    }

    return and(...conditions);
  }
}
