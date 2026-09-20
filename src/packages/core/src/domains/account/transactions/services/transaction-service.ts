import type { Account } from "@core/domains/account/entities/account";
import type { AccountRepository } from "@core/domains/account/repositories/account-repository";
import type {
  ApplyOnCreateResult,
  RuleEngineService,
} from "@core/domains/account/rules/services/rule-engine-service";
import type { AccountService } from "@core/domains/account/services/account-service";
import type { CategoryRepository } from "@core/domains/account/taxonomy/repositories/category-repository";
import type { TagRepository } from "@core/domains/account/taxonomy/repositories/tag-repository";
import { MAX_BATCH_SIZE } from "@core/domains/account/transactions/constants";
import type { MonthlySummary } from "@core/domains/account/transactions/entities/monthly-summary";
import { Transaction } from "@core/domains/account/transactions/entities/transaction";
import { TransactionImport } from "@core/domains/account/transactions/entities/transaction-import";
import {
  assertAllowedTransactionPair,
  computeBalanceAsOf,
} from "@core/domains/account/transactions/helpers";
import type {
  TransactionFilters,
  TransactionRepository,
} from "@core/domains/account/transactions/repositories/transaction-repository";
import { parseTransactionsCsv } from "@core/domains/account/transactions/services/vault-csv";
import { assertAal2 } from "@core/domains/auth/helpers";
import type { User } from "@core/domains/user/entities/user/index";
import { EntityNotFoundError, ValidationError } from "@core/shared/errors/domain-error";
import { parseRupeeToInteger } from "@core/shared/money";
import type { Pagination } from "@core/shared/query";
import { Time } from "@core/shared/time";

export type CreateTransactionInput = {
  date: string;
  amount: number;
  sourceAccountId: string;
  destinationAccountId: string;
  description: string;
  refNo?: string | null;
  importId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  tagIds?: string[];
};

type VaultCsvMappedRow = {
  date: string;
  amount: number;
  sourceAccountId: string;
  destinationAccountId: string;
  description: string;
  refNo: string | null;
};

function mapVaultCsvRows(
  parsed: ReturnType<typeof parseTransactionsCsv>,
  accountId: string,
  unknownAccountId: string
): VaultCsvMappedRow[] {
  const mapped: VaultCsvMappedRow[] = [];
  for (const row of parsed) {
    const credit = parseRupeeToInteger(row.credited);
    const debit = parseRupeeToInteger(row.debited);
    const amount = debit > 0 ? debit : credit;
    if (amount <= 0) {
      continue;
    }
    mapped.push({
      date: row.date,
      amount,
      sourceAccountId: debit > 0 ? accountId : unknownAccountId,
      destinationAccountId: debit > 0 ? unknownAccountId : accountId,
      description: row.description,
      refNo: row.ref?.trim() ? row.ref.trim() : null,
    });
  }
  return mapped;
}

export type UpdateTransactionInput = {
  date: string;
  amount: number;
  sourceAccountId: string;
  destinationAccountId: string;
  description: string;
  refNo?: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  tagIds: string[];
};

export type RangeSummary = {
  from: string;
  to: string;
  opening: number;
  closing: number;
  amountCredit: number;
  amountDebit: number;
  txnCount: number;
};

export type TransactionListRange = {
  from?: string;
  to?: string;
  word?: string;
  categoryId?: string;
  subcategoryId?: string;
  tagId?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  amountMin?: number;
  amountMax?: number;
};

function assertUniqueBulkIds(items: Array<{ id: string }>): void {
  if (items.length === 0) {
    throw new ValidationError("Choose at least one transaction.");
  }
  if (items.length > MAX_BATCH_SIZE) {
    throw new ValidationError("Transaction batch is too large.", {
      context: { max: MAX_BATCH_SIZE, count: items.length },
    });
  }
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      throw new ValidationError("Each transaction can only be updated once.", {
        field: "id",
        context: { id: item.id },
      });
    }
    seen.add(item.id);
  }
}

function earlierIsoDate(current: string, candidate: string): string {
  return Time.compareIsoDates(candidate, current) < 0 ? candidate : current;
}

function listFiltersFromRange(
  userId: string,
  accountId: string,
  range: TransactionListRange
): TransactionFilters {
  return {
    userId,
    accountId,
    from: range.from,
    to: range.to,
    word: range.word,
    categoryId: range.categoryId,
    subcategoryId: range.subcategoryId,
    tagId: range.tagId,
    sourceAccountId: range.sourceAccountId,
    destinationAccountId: range.destinationAccountId,
    amountMin: range.amountMin,
    amountMax: range.amountMax,
  };
}

export class TransactionService {
  private ruleEngine: RuleEngineService | null = null;

  constructor(
    private readonly transactions: TransactionRepository,
    private readonly accounts: AccountRepository,
    private readonly categories: CategoryRepository,
    private readonly tags: TagRepository,
    private readonly accountService?: AccountService
  ) {}

  attachRuleEngine(engine: RuleEngineService): void {
    this.ruleEngine = engine;
  }

  async createImport(user: User, authAcr: string, accountId: string): Promise<TransactionImport> {
    assertAal2(user.multifactorEnabled, authAcr);
    await this.requireAccount(user.id, accountId);
    const row = TransactionImport.create({ userId: user.id, accountId });
    return this.transactions.createImport(row);
  }

  async deleteImport(
    user: User,
    authAcr: string,
    accountId: string,
    importId: string
  ): Promise<void> {
    assertAal2(user.multifactorEnabled, authAcr);
    await this.requireAccount(user.id, accountId);
    const deleted = await this.transactions.deleteImport(user.id, accountId, importId);
    if (!deleted) {
      throw new EntityNotFoundError("TransactionImport", importId);
    }
    await this.rebuildSummariesFromEarliestDate(user.id, accountId);
  }

  async create(
    user: User,
    authAcr: string,
    pageAccountId: string,
    input: CreateTransactionInput
  ): Promise<Transaction | null> {
    assertAal2(user.multifactorEnabled, authAcr);
    await this.ensureSystem(user.id);
    const { source, dest } = await this.loadPair(
      user.id,
      input.sourceAccountId,
      input.destinationAccountId
    );
    if (pageAccountId !== source.id && pageAccountId !== dest.id) {
      throw new EntityNotFoundError("Account", pageAccountId);
    }
    assertAllowedTransactionPair(source, dest);
    await this.assertTaxonomy(
      user.id,
      input.categoryId ?? null,
      input.subcategoryId ?? null,
      input.tagIds ?? []
    );
    const txn = Transaction.create({
      userId: user.id,
      ...input,
    });
    const saved = await this.transactions.create(txn);
    const engineResult = await this.runOnCreateThenRebuild(
      user.id,
      [saved],
      [source.id, dest.id],
      txn.date
    );
    if (engineResult?.deletedIds.includes(saved.id)) {
      return null;
    }
    if (engineResult) {
      return engineResult.rows[0] ?? null;
    }
    return saved;
  }

  async ingestVaultCsv(
    userId: string,
    accountId: string,
    unknownAccountId: string,
    csvText: string,
    existingImportId: string | null
  ): Promise<string | null> {
    await this.ensureSystem(userId);
    if (typeof existingImportId === "string") {
      await this.transactions.deleteImport(userId, accountId, existingImportId);
    }

    const mapped = mapVaultCsvRows(parseTransactionsCsv(csvText), accountId, unknownAccountId);
    if (mapped.length === 0) {
      return null;
    }

    const importRow = TransactionImport.create({ userId, accountId });
    await this.transactions.createImport(importRow);
    const importId = importRow.id;

    const { persisted, earliestDate } = await this.persistVaultCsvBatches(userId, importId, mapped);
    await this.runOnCreateThenRebuild(
      userId,
      persisted,
      [accountId, unknownAccountId],
      earliestDate
    );
    return importId;
  }

  async createMany(
    user: User,
    authAcr: string,
    pageAccountId: string,
    importId: string,
    items: CreateTransactionInput[]
  ): Promise<Transaction[]> {
    assertAal2(user.multifactorEnabled, authAcr);
    await this.ensureSystem(user.id);
    await this.requireAccount(user.id, pageAccountId);
    if (items.length === 0) {
      return [];
    }
    if (items.length > MAX_BATCH_SIZE) {
      throw new ValidationError("Transaction batch is too large.", {
        context: { max: MAX_BATCH_SIZE, count: items.length },
      });
    }

    const accountIds = new Set<string>();
    const rows: Transaction[] = [];
    for (const item of items) {
      const { source, dest } = await this.loadPair(
        user.id,
        item.sourceAccountId,
        item.destinationAccountId
      );
      if (pageAccountId !== source.id && pageAccountId !== dest.id) {
        throw new ValidationError("Page account is invalid for this batch.");
      }
      assertAllowedTransactionPair(source, dest);
      await this.assertTaxonomy(
        user.id,
        item.categoryId ?? null,
        item.subcategoryId ?? null,
        item.tagIds ?? []
      );
      accountIds.add(source.id);
      accountIds.add(dest.id);
      rows.push(
        Transaction.create({
          userId: user.id,
          importId,
          ...item,
        })
      );
    }
    const saved = await this.transactions.createMany(rows);
    const earliest = saved.reduce(
      (min, row) => (Time.compareIsoDates(row.date, min) < 0 ? row.date : min),
      saved[0]?.date ?? Time.monthStartIso(1970, 1)
    );
    const engineResult = await this.runOnCreateThenRebuild(
      user.id,
      saved,
      [...accountIds],
      earliest
    );
    if (engineResult) {
      return engineResult.rows;
    }
    return saved;
  }

  async update(
    user: User,
    authAcr: string,
    pageAccountId: string,
    transactionId: string,
    input: UpdateTransactionInput
  ): Promise<Transaction> {
    assertAal2(user.multifactorEnabled, authAcr);
    await this.ensureSystem(user.id);
    const existing = await this.transactions.findById(user.id, transactionId);
    if (!existing?.involvesAccount(pageAccountId)) {
      throw new EntityNotFoundError("Transaction", transactionId);
    }
    if (!existing) {
      throw new EntityNotFoundError("Transaction", transactionId);
    }
    const { source, dest } = await this.loadPair(
      user.id,
      input.sourceAccountId,
      input.destinationAccountId
    );
    assertAllowedTransactionPair(source, dest);
    await this.assertTaxonomy(user.id, input.categoryId, input.subcategoryId, input.tagIds);
    const updated = existing.withUpdates({
      ...input,
      updatedAt: new Date().toISOString(),
    });
    const saved = await this.transactions.save(updated);
    const earliest =
      Time.compareIsoDates(existing.date, saved.date) < 0 ? existing.date : saved.date;
    await this.rebuildForAccounts(
      user.id,
      [existing.sourceAccountId, existing.destinationAccountId, source.id, dest.id],
      earliest
    );
    return saved;
  }

  async updateMany(
    user: User,
    authAcr: string,
    pageAccountId: string,
    items: Array<UpdateTransactionInput & { id: string }>
  ): Promise<number> {
    assertAal2(user.multifactorEnabled, authAcr);
    await this.ensureSystem(user.id);
    await this.requireAccount(user.id, pageAccountId);
    assertUniqueBulkIds(items);

    const existingById = await this.loadBulkUpdateRows(user.id, pageAccountId, items);
    const { updatedRows, accountIds, earliest } = await this.buildBulkUpdates(
      user.id,
      items,
      existingById
    );

    await this.transactions.saveMany(updatedRows);
    await this.rebuildForAccounts(user.id, [...accountIds], earliest);
    return updatedRows.length;
  }

  private async loadBulkUpdateRows(
    userId: string,
    pageAccountId: string,
    items: Array<{ id: string }>
  ): Promise<Map<string, Transaction>> {
    const existingRows = await this.transactions.findByIds(
      userId,
      items.map((item) => item.id)
    );
    const existingById = new Map(existingRows.map((row) => [row.id, row]));
    for (const item of items) {
      const existing = existingById.get(item.id);
      if (!existing?.involvesAccount(pageAccountId)) {
        throw new EntityNotFoundError("Transaction", item.id);
      }
    }
    return existingById;
  }

  private async buildBulkUpdates(
    userId: string,
    items: Array<UpdateTransactionInput & { id: string }>,
    existingById: Map<string, Transaction>
  ): Promise<{ updatedRows: Transaction[]; accountIds: Set<string>; earliest: string }> {
    const pairs = new Map<string, { source: Account; dest: Account }>();
    const updatedAt = new Date().toISOString();
    const updatedRows: Transaction[] = [];
    const accountIds = new Set<string>();
    const first = items[0];
    let earliest = first ? (existingById.get(first.id)?.date ?? first.date) : updatedAt;

    for (const item of items) {
      const existing = existingById.get(item.id);
      if (!existing) {
        throw new EntityNotFoundError("Transaction", item.id);
      }
      const pair = await this.bulkPair(userId, pairs, item);
      assertAllowedTransactionPair(pair.source, pair.dest);
      await this.assertTaxonomy(userId, item.categoryId, item.subcategoryId, item.tagIds);
      const updated = existing.withUpdates({
        date: item.date,
        amount: item.amount,
        sourceAccountId: item.sourceAccountId,
        destinationAccountId: item.destinationAccountId,
        description: item.description,
        refNo: item.refNo,
        categoryId: item.categoryId,
        subcategoryId: item.subcategoryId,
        tagIds: item.tagIds,
        updatedAt,
      });
      updatedRows.push(updated);
      accountIds.add(existing.sourceAccountId);
      accountIds.add(existing.destinationAccountId);
      accountIds.add(pair.source.id);
      accountIds.add(pair.dest.id);
      earliest = earlierIsoDate(earliest, existing.date);
      earliest = earlierIsoDate(earliest, updated.date);
    }

    return { updatedRows, accountIds, earliest };
  }

  private async bulkPair(
    userId: string,
    pairs: Map<string, { source: Account; dest: Account }>,
    item: { sourceAccountId: string; destinationAccountId: string }
  ): Promise<{ source: Account; dest: Account }> {
    const pairKey = `${item.sourceAccountId}:${item.destinationAccountId}`;
    const cached = pairs.get(pairKey);
    if (cached) {
      return cached;
    }
    const pair = await this.loadPair(userId, item.sourceAccountId, item.destinationAccountId);
    pairs.set(pairKey, pair);
    return pair;
  }

  async delete(
    user: User,
    authAcr: string,
    accountId: string,
    transactionId: string
  ): Promise<void> {
    assertAal2(user.multifactorEnabled, authAcr);
    await this.requireAccount(user.id, accountId);
    const existing = await this.transactions.findById(user.id, transactionId);
    if (!existing?.involvesAccount(accountId)) {
      throw new EntityNotFoundError("Transaction", transactionId);
    }
    if (!existing) {
      throw new EntityNotFoundError("Transaction", transactionId);
    }
    await this.transactions.delete(user.id, transactionId);
    await this.rebuildForAccounts(
      user.id,
      [existing.sourceAccountId, existing.destinationAccountId],
      existing.date
    );
  }

  async deleteMany(
    user: User,
    authAcr: string,
    pageAccountId: string,
    ids: string[]
  ): Promise<number> {
    assertAal2(user.multifactorEnabled, authAcr);
    await this.ensureSystem(user.id);
    await this.requireAccount(user.id, pageAccountId);
    if (ids.length === 0) {
      throw new ValidationError("Choose at least one transaction.");
    }
    if (ids.length > MAX_BATCH_SIZE) {
      throw new ValidationError("Transaction batch is too large.", {
        context: { max: MAX_BATCH_SIZE, count: ids.length },
      });
    }
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) {
        throw new ValidationError("Each transaction can only be deleted once.", {
          field: "id",
          context: { id },
        });
      }
      seen.add(id);
    }

    const existingRows = await this.transactions.findByIds(user.id, ids);
    const existingById = new Map(existingRows.map((row) => [row.id, row]));
    const accountIds = new Set<string>();
    let earliest = existingRows[0]?.date ?? "";
    for (const id of ids) {
      const existing = existingById.get(id);
      if (!existing?.involvesAccount(pageAccountId)) {
        throw new EntityNotFoundError("Transaction", id);
      }
      accountIds.add(existing.sourceAccountId);
      accountIds.add(existing.destinationAccountId);
      if (!earliest || Time.compareIsoDates(existing.date, earliest) < 0) {
        earliest = existing.date;
      }
    }

    const deleted = await this.transactions.deleteMany(user.id, ids);
    await this.rebuildForAccounts(user.id, [...accountIds], earliest);
    return deleted;
  }

  async listInRange(
    user: User,
    authAcr: string,
    accountId: string,
    range: TransactionListRange,
    pagination?: Pagination
  ): Promise<{ items: Transaction[]; total: number }> {
    assertAal2(user.multifactorEnabled, authAcr);
    await this.requireAccount(user.id, accountId);
    const filters = listFiltersFromRange(user.id, accountId, range);
    const [items, total] = await Promise.all([
      this.transactions.findByFilters(
        filters,
        {
          column: "date",
          direction: "desc",
        },
        pagination
      ),
      this.transactions.aggregate(filters),
    ]);
    return { items, total };
  }

  async balanceAsOf(user: User, authAcr: string, accountId: string, on: string): Promise<number> {
    assertAal2(user.multifactorEnabled, authAcr);
    await this.requireAccount(user.id, accountId);
    return computeBalanceAsOf(this.transactions, user.id, accountId, on);
  }

  async summarizeRange(
    user: User,
    authAcr: string,
    accountId: string,
    range: TransactionListRange = {}
  ): Promise<RangeSummary> {
    assertAal2(user.multifactorEnabled, authAcr);
    await this.requireAccount(user.id, accountId);

    const { from, to, ...listFilters } = range;
    const unbounded = from === undefined && to === undefined;
    let effectiveFrom = from;
    let effectiveTo = to;
    if (unbounded) {
      effectiveTo = Time.utcTodayIsoDate();
      const extent = await this.transactions.getDateExtent({ userId: user.id, accountId });
      effectiveFrom = extent.min ?? effectiveTo;
    } else if (!effectiveFrom || !effectiveTo) {
      throw new ValidationError("Date range is invalid.", {
        field: "from",
        context: { from, to },
      });
    }

    if (Time.compareIsoDates(effectiveFrom, effectiveTo) > 0) {
      throw new ValidationError("Date range is invalid.", {
        field: "from",
        context: { from: effectiveFrom, to: effectiveTo },
      });
    }

    const sumFilters = listFiltersFromRange(user.id, accountId, {
      ...listFilters,
      ...(unbounded ? {} : { from: effectiveFrom, to: effectiveTo }),
    });

    const [opening, closing, totals] = await Promise.all([
      computeBalanceAsOf(
        this.transactions,
        user.id,
        accountId,
        Time.addIsoCalendarDays(effectiveFrom, -1)
      ),
      computeBalanceAsOf(this.transactions, user.id, accountId, effectiveTo),
      this.transactions.sumAmounts(sumFilters),
    ]);
    return {
      from: effectiveFrom,
      to: effectiveTo,
      opening,
      closing,
      amountCredit: totals.amountCredit,
      amountDebit: totals.amountDebit,
      txnCount: totals.txnCount,
    };
  }

  private async ensureSystem(userId: string): Promise<void> {
    await this.accountService?.ensureSystemAccounts(userId);
  }

  private async assertTaxonomy(
    userId: string,
    categoryId: string | null,
    subcategoryId: string | null,
    tagIds: string[]
  ): Promise<void> {
    if (categoryId === null && subcategoryId === null && tagIds.length === 0) {
      return;
    }
    const category = await this.assertRootCategory(userId, categoryId);
    await this.assertSubcategory(userId, categoryId, subcategoryId, category);
    await this.assertAllTags(userId, tagIds);
  }

  private async assertRootCategory(
    userId: string,
    categoryId: string | null
  ): Promise<Awaited<ReturnType<CategoryRepository["findById"]>>> {
    if (categoryId === null) {
      return null;
    }
    const category = await this.categories.findById(userId, categoryId);
    if (!category) {
      throw new EntityNotFoundError("Category", categoryId);
    }
    if (category.parentId !== null) {
      throw new ValidationError("Category must be a root category.", { field: "categoryId" });
    }
    return category;
  }

  private async assertSubcategory(
    userId: string,
    categoryId: string | null,
    subcategoryId: string | null,
    _category: Awaited<ReturnType<CategoryRepository["findById"]>>
  ): Promise<void> {
    if (subcategoryId === null) {
      return;
    }
    const subcategory = await this.categories.findById(userId, subcategoryId);
    if (!subcategory) {
      throw new EntityNotFoundError("Category", subcategoryId);
    }
    if (categoryId === null || subcategory.parentId !== categoryId) {
      throw new ValidationError("Subcategory does not belong to the selected category.", {
        context: { categoryId, subcategoryId },
      });
    }
  }

  private async assertAllTags(userId: string, tagIds: string[]): Promise<void> {
    const uniqueTagIds = [...new Set(tagIds)];
    const tags = await Promise.all(uniqueTagIds.map((tagId) => this.tags.findById(userId, tagId)));
    for (let i = 0; i < uniqueTagIds.length; i++) {
      const tagId = uniqueTagIds[i];
      if (tagId === undefined || !tags[i]) {
        throw new EntityNotFoundError("Tag", tagId ?? "");
      }
    }
  }

  private async persistVaultCsvBatches(
    userId: string,
    importId: string,
    mapped: VaultCsvMappedRow[]
  ): Promise<{ persisted: Transaction[]; earliestDate: string }> {
    let earliestDate = mapped[0]?.date ?? Time.monthStartIso(1970, 1);
    const persisted: Transaction[] = [];
    for (let offset = 0; offset < mapped.length; offset += MAX_BATCH_SIZE) {
      const slice = mapped.slice(offset, offset + MAX_BATCH_SIZE);
      const rows: Transaction[] = [];
      for (const item of slice) {
        const { source, dest } = await this.loadPair(
          userId,
          item.sourceAccountId,
          item.destinationAccountId
        );
        assertAllowedTransactionPair(source, dest);
        if (Time.compareIsoDates(item.date, earliestDate) < 0) {
          earliestDate = item.date;
        }
        rows.push(
          Transaction.create({
            userId,
            importId,
            date: item.date,
            amount: item.amount,
            sourceAccountId: item.sourceAccountId,
            destinationAccountId: item.destinationAccountId,
            description: item.description,
            refNo: item.refNo,
          })
        );
      }
      const batch = await this.transactions.createMany(rows);
      persisted.push(...batch);
    }
    return { persisted, earliestDate };
  }

  private async loadPair(
    userId: string,
    sourceAccountId: string,
    destinationAccountId: string
  ): Promise<{ source: Account; dest: Account }> {
    const [source, dest] = await Promise.all([
      this.accounts.findById(userId, sourceAccountId),
      this.accounts.findById(userId, destinationAccountId),
    ]);
    if (!source || !dest) {
      throw new EntityNotFoundError("Account", sourceAccountId, { destinationAccountId });
    }
    return { source, dest };
  }

  private async requireAccount(userId: string, accountId: string): Promise<Account> {
    const account = await this.accounts.findById(userId, accountId);
    if (!account) {
      throw new EntityNotFoundError("Account", accountId);
    }
    return account;
  }

  private async runOnCreateThenRebuild(
    userId: string,
    saved: Transaction[],
    extraAccountIds: string[],
    extraEarliest: string
  ): Promise<ApplyOnCreateResult | null> {
    if (saved.length === 0) {
      await this.rebuildForAccounts(userId, extraAccountIds, extraEarliest);
      return null;
    }
    if (!this.ruleEngine) {
      await this.rebuildForAccounts(userId, extraAccountIds, extraEarliest);
      return null;
    }
    const result = await this.ruleEngine.applyOnCreate(userId, saved);
    const accountIds = [...new Set([...extraAccountIds, ...result.accountIds])];
    const earliest =
      Time.compareIsoDates(extraEarliest, result.earliestDate) < 0
        ? extraEarliest
        : result.earliestDate;
    await this.rebuildForAccounts(userId, accountIds, earliest);
    return result;
  }

  async rebuildSummariesForAccounts(
    userId: string,
    accountIds: string[],
    earliestDate: string
  ): Promise<void> {
    await this.rebuildForAccounts(userId, accountIds, earliestDate);
  }

  private async rebuildForAccounts(
    userId: string,
    accountIds: string[],
    earliestDate: string
  ): Promise<void> {
    const unique = [...new Set(accountIds)];
    await Promise.all(
      unique.map((accountId) => this.rebuildSummariesFromEarliest(userId, accountId, earliestDate))
    );
  }

  private async rebuildSummariesFromEarliestDate(userId: string, accountId: string): Promise<void> {
    const first = await this.transactions.findByFilters(
      { userId, accountId },
      { column: "date", direction: "asc" },
      { limit: 1, offset: 0 }
    );
    const earliest = first[0]?.date ?? Time.monthStartIso(1970, 1);
    await this.rebuildSummariesFromEarliest(userId, accountId, earliest);
  }

  private async rebuildSummariesFromEarliest(
    userId: string,
    accountId: string,
    earliestDate: string
  ): Promise<void> {
    const { year, month } = Time.yearMonthFromIso(earliestDate);
    await this.transactions.deleteMonthlySummariesFrom(userId, accountId, year, month);

    const prior = await this.transactions.latestMonthlySummaryBefore(
      userId,
      accountId,
      Time.addIsoCalendarDays(Time.monthStartIso(year, month), -1)
    );
    let opening = prior?.amountClosing ?? 0;

    const txns = await this.transactions.findByFilters(
      {
        userId,
        accountId,
        from: Time.monthStartIso(year, month),
      },
      { column: "date", direction: "asc" }
    );

    const byMonth = new Map<string, Transaction[]>();
    for (const txn of txns) {
      const key = txn.date.slice(0, 7);
      const bucket = byMonth.get(key) ?? [];
      bucket.push(txn);
      byMonth.set(key, bucket);
    }

    const keys = [...byMonth.keys()].sort();
    const newRows: MonthlySummary[] = [];
    const now = new Date().toISOString();

    for (const key of keys) {
      const [yStr, mStr] = key.split("-");
      const y = Number.parseInt(yStr ?? "0", 10);
      const m = Number.parseInt(mStr ?? "0", 10);
      const bucket = byMonth.get(key) ?? [];
      let credit = 0;
      let debit = 0;
      for (const txn of bucket) {
        if (txn.destinationAccountId === accountId) {
          credit += txn.amount;
        }
        if (txn.sourceAccountId === accountId) {
          debit += txn.amount;
        }
      }
      const closing = opening + credit - debit;
      newRows.push({
        id: crypto.randomUUID(),
        userId,
        accountId,
        year: y,
        month: m,
        periodStart: Time.monthStartIso(y, m),
        periodEnd: Time.monthEndIso(y, m),
        amountCredit: credit,
        amountDebit: debit,
        amountOpening: opening,
        amountClosing: closing,
        txnCount: bucket.length,
        createdAt: now,
        updatedAt: now,
      });
      opening = closing;
    }

    await this.transactions.replaceMonthlySummaries(userId, accountId, newRows);
  }
}
