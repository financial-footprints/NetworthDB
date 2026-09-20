import { type Cryptography, cryptography } from "@database/encryption";
import { DrizzleTransactionRepository } from "@database/repositories/account/drizzle-transaction-repository";
import {
  applyPagination,
  applySort,
  escapeLikePattern,
  isUniqueViolation,
} from "@database/repositories/helpers";
import { accounts } from "@database/schema/accounts";
import { transactionsMonthlySummary } from "@database/schema/transactions/monthly-summary";
import { transactions } from "@database/schema/transactions/transactions";
import type { DbClient } from "@database/types";
import {
  Account,
  type AccountFilters,
  type AccountListItem,
  type AccountRepository,
  type AccountSortColumn,
  ConflictError,
  isSystemAccountType,
  type MailRules,
  ONE,
  type Pagination,
  type Sort,
  type StatementRules,
  Time,
} from "@ndb/core";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  or,
  type SQL,
  sql,
} from "drizzle-orm";

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

function toRow(account: Account, blob: Buffer | null) {
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

function emptySecrets(): AccountSecrets {
  return { passwords: [], mail: null, statement: null };
}

async function secretsBlobFor(
  account: Account,
  crypto: Cryptography,
  db: DbClient
): Promise<Buffer | null> {
  if (isSystemAccountType(account.accountType)) {
    return null;
  }
  return crypto.encrypt(
    db,
    account.userId,
    Buffer.from(JSON.stringify(toSecrets(account)), "utf8")
  );
}

async function mapRow(
  crypto: Cryptography,
  db: DbClient,
  row: typeof accounts.$inferSelect
): Promise<Account> {
  let secrets: AccountSecrets = emptySecrets();
  if (row.secrets) {
    const raw = (await crypto.decrypt(db, row.userId, row.secrets)).toString("utf8");
    secrets = JSON.parse(raw) as AccountSecrets;
  }

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

/** Balance-as-of for account list tiles (same rules as core `computeBalanceAsOf`; ADR-006). */
function balanceAsOfSql(asOfIsoDate: string, userId: string): SQL {
  return sql`coalesce((
    select snap.amount_closing + coalesce((
      select coalesce(sum(case when ${transactions.destinationAccountId} = ${accounts.id} then ${transactions.amount} else 0 end), 0)
           - coalesce(sum(case when ${transactions.sourceAccountId} = ${accounts.id} then ${transactions.amount} else 0 end), 0)
      from ${transactions}
      where ${transactions.userId} = ${userId}
        and (${transactions.sourceAccountId} = ${accounts.id} or ${transactions.destinationAccountId} = ${accounts.id})
        and ${transactions.date} > snap.period_end
        and ${transactions.date} <= ${asOfIsoDate}
    ), 0)
    from (
      select ${transactionsMonthlySummary.amountClosing} as amount_closing,
             ${transactionsMonthlySummary.periodEnd} as period_end
      from ${transactionsMonthlySummary}
      where ${transactionsMonthlySummary.accountId} = ${accounts.id}
        and ${transactionsMonthlySummary.userId} = ${userId}
        and ${transactionsMonthlySummary.periodEnd} <= ${asOfIsoDate}
      order by ${transactionsMonthlySummary.year} desc, ${transactionsMonthlySummary.month} desc
      limit 1
    ) snap
  ), (
    select coalesce(sum(case when ${transactions.destinationAccountId} = ${accounts.id} then ${transactions.amount} else 0 end), 0)
         - coalesce(sum(case when ${transactions.sourceAccountId} = ${accounts.id} then ${transactions.amount} else 0 end), 0)
    from ${transactions}
    where ${transactions.userId} = ${userId}
      and (${transactions.sourceAccountId} = ${accounts.id} or ${transactions.destinationAccountId} = ${accounts.id})
      and ${transactions.date} <= ${asOfIsoDate}
  ), 0)`;
}

export class DrizzleAccountRepository implements AccountRepository {
  readonly transactions: DrizzleTransactionRepository;

  constructor(
    private readonly db: DbClient,
    private readonly crypto: Cryptography = cryptography
  ) {
    this.transactions = new DrizzleTransactionRepository(db);
  }

  async create(account: Account): Promise<Account> {
    try {
      const secretsBlob = await secretsBlobFor(account, this.crypto, this.db);
      const rows = await this.db.insert(accounts).values(toRow(account, secretsBlob)).returning();
      const row = rows[0];
      if (!row) {
        throw new Error("database.account.create.error.no-row");
      }

      return mapRow(this.crypto, this.db, row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("Account id is already taken.", {
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
    const orderBy = this._orderByForAccounts(sort);
    let query = this.db.select().from(accounts).$dynamic();
    if (where) {
      query = query.where(where);
    }
    if (orderBy) {
      query = query.orderBy(orderBy);
    }

    const rows = await applyPagination(query, pagination);
    return Promise.all(rows.map((row) => mapRow(this.crypto, this.db, row)));
  }

  async listWithBalances(
    filters: AccountFilters,
    sort?: Sort<AccountSortColumn>
  ): Promise<AccountListItem[]> {
    const where = this._filter(filters);
    const asOf = filters.asOfIsoDate ?? Time.utcTodayIsoDate();
    const userId = filters.userId ?? "";
    const balanceExpr = balanceAsOfSql(asOf, userId);
    const orderBy = this._orderByForList(balanceExpr, sort);

    let query = this.db
      .select({
        account: accounts,
        currentBalance: balanceExpr,
      })
      .from(accounts)
      .$dynamic();

    if (where) {
      query = query.where(where);
    }
    if (orderBy) {
      query = query.orderBy(orderBy);
    }

    const rows = await query;
    return Promise.all(
      rows.map(async (row) => ({
        account: await mapRow(this.crypto, this.db, row.account),
        currentBalance: Number(row.currentBalance ?? 0),
      }))
    );
  }

  async save(account: Account): Promise<Account> {
    const secretsBlob = await secretsBlobFor(account, this.crypto, this.db);

    const rows = await this.db
      .update(accounts)
      .set(toRow(account, secretsBlob))
      .where(and(eq(accounts.id, account.id), eq(accounts.userId, account.userId)))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error("database.account.save.error.no-row");
    }

    return mapRow(this.crypto, this.db, row);
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
    } else if (filters.accountTypes !== undefined && filters.accountTypes.length > 0) {
      conditions.push(inArray(accounts.accountType, [...filters.accountTypes]));
    }
    if (filters.listStatus === "open") {
      const asOf = filters.asOfIsoDate ?? "";
      conditions.push(or(isNull(accounts.closingDate), gte(accounts.closingDate, asOf)) as SQL);
    } else if (filters.listStatus === "closed") {
      const asOf = filters.asOfIsoDate ?? "";
      conditions.push(
        and(sql`${accounts.closingDate} is not null`, lt(accounts.closingDate, asOf)) as SQL
      );
    }
    if (filters.q !== undefined && filters.q.trim() !== "") {
      const escaped = escapeLikePattern(filters.q.trim());
      const pattern = `%${escaped}%`;
      conditions.push(
        sql`(${accounts.label} ilike ${pattern} escape '\\' or ${accounts.bank} ilike ${pattern} escape '\\')`
      );
    }

    if (conditions.length === 0) {
      return undefined;
    }

    return and(...conditions);
  }

  private _orderByForAccounts(sort?: Sort<AccountSortColumn>): SQL | undefined {
    if (!sort) {
      return undefined;
    }

    if (sort.column === "accountType") {
      return sort.direction === "desc" ? desc(accounts.accountType) : asc(accounts.accountType);
    }

    if (sort.column === "createdAt" || sort.column === "label") {
      return applySort<"createdAt" | "label">(
        { createdAt: accounts.createdAt, label: accounts.label },
        { column: sort.column, direction: sort.direction }
      );
    }

    return applySort<"label">(
      { label: accounts.label },
      { column: "label", direction: sort.direction }
    );
  }

  private _orderByForList(balanceExpr: SQL, sort?: Sort<AccountSortColumn>): SQL | undefined {
    const effective = sort ?? { column: "label", direction: "asc" as const };

    if (effective.column === "currentBalance") {
      return effective.direction === "desc" ? desc(balanceExpr) : asc(balanceExpr);
    }

    return this._orderByForAccounts(effective);
  }
}
