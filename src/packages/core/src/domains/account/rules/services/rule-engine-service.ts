import { isSystemAccountType, type SystemAccountType } from "@core/domains/account/constants";
import type { Account } from "@core/domains/account/entities/account";
import type { AccountRepository } from "@core/domains/account/repositories/account-repository";
import { MAX_RULES_APPLY_PAGE } from "@core/domains/account/rules/constants";
import {
  applyActions,
  matchWhen,
  walkRules,
} from "@core/domains/account/rules/embedded/match-apply";
import type { RuleAction, RuleEvalContext } from "@core/domains/account/rules/embedded/types";
import type { TransactionRule } from "@core/domains/account/rules/entities/transaction-rule";
import type { TransactionRuleGroup } from "@core/domains/account/rules/entities/transaction-rule-group";
import type { RuleGroupRepository } from "@core/domains/account/rules/repositories/rule-group-repository";
import type { RuleRepository } from "@core/domains/account/rules/repositories/rule-repository";
import type { Category } from "@core/domains/account/taxonomy/entities/category";
import type { Tag } from "@core/domains/account/taxonomy/entities/tag";
import type { CategoryRepository } from "@core/domains/account/taxonomy/repositories/category-repository";
import type { TagRepository } from "@core/domains/account/taxonomy/repositories/tag-repository";
import { Transaction } from "@core/domains/account/transactions/entities/transaction";
import type {
  TransactionFilters,
  TransactionRepository,
} from "@core/domains/account/transactions/repositories/transaction-repository";
import { EntityNotFoundError, ValidationError } from "@core/shared/errors/domain-error";
import { Time } from "@core/shared/time";

export type ApplyOnCreateResult = {
  rows: Transaction[];
  deletedIds: string[];
  accountIds: string[];
  earliestDate: string;
  warnings: string[];
};

export type ApplyManualInput = {
  userId: string;
  mode: { type: "rule"; ruleId: string } | { type: "group"; groupId: string };
  filters: TransactionFilters;
  dryRun: boolean;
  shouldCancel?: () => boolean;
};

export type ApplyManualResult = {
  matched: number;
  mutated: number;
  deleted: number;
  skipped: number;
  accountIds: string[];
  earliestDate: string;
  warnings: string[];
  dryRun: boolean;
};

export type TestRuleSnapshot = {
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

export type TestRuleResult = {
  matched: boolean;
  actions: RuleAction[];
  warnings: string[];
};

function buildSystemByType(accounts: Account[]): Partial<Record<SystemAccountType, Account>> {
  const systemByType: Partial<Record<SystemAccountType, Account>> = {};
  for (const account of accounts) {
    if (isSystemAccountType(account.accountType)) {
      systemByType[account.accountType] = account;
    }
  }
  return systemByType;
}

function groupRulesByGroupId(rules: TransactionRule[]): Map<string, TransactionRule[]> {
  const map = new Map<string, TransactionRule[]>();
  for (const rule of rules) {
    const list = map.get(rule.groupId) ?? [];
    list.push(rule);
    map.set(rule.groupId, list);
  }
  return map;
}

function minIsoDate(left: string, right: string): string {
  return Time.compareIsoDates(left, right) < 0 ? left : right;
}

function unionAccountIds(txn: Transaction, finalTxn: Transaction, into: Set<string>): void {
  into.add(txn.sourceAccountId);
  into.add(txn.destinationAccountId);
  into.add(finalTxn.sourceAccountId);
  into.add(finalTxn.destinationAccountId);
}

function buildEvalContext(
  txn: Transaction,
  accountsById: Map<string, Account>,
  categoriesById: Map<string, Category>,
  tagsById: Map<string, Tag>,
  systemByType: Partial<Record<SystemAccountType, Account>>
): RuleEvalContext | null {
  const source = accountsById.get(txn.sourceAccountId);
  const dest = accountsById.get(txn.destinationAccountId);
  if (!source || !dest) {
    return null;
  }
  return {
    source,
    dest,
    accountsById,
    categoriesById,
    tagsById,
    systemByType,
  };
}

type ManualApplyRunState = {
  matched: number;
  mutated: number;
  deleted: number;
  skipped: number;
  accountIdSet: Set<string>;
  warnings: string[];
  earliestDate: string;
};

type ManualApplyEvalMaps = {
  accountsById: Map<string, Account>;
  categoriesById: Map<string, Category>;
  tagsById: Map<string, Tag>;
  systemByType: Partial<Record<SystemAccountType, Account>>;
};

function manualApplyResult(state: ManualApplyRunState, dryRun: boolean): ApplyManualResult {
  return {
    matched: state.matched,
    mutated: state.mutated,
    deleted: state.deleted,
    skipped: state.skipped,
    accountIds: [...state.accountIdSet],
    earliestDate: state.earliestDate,
    warnings: state.warnings,
    dryRun,
  };
}

function bumpManualApplyEarliestDate(
  emptyEarliest: string,
  earliestDate: string,
  txn: Transaction,
  walkedTxn: Transaction
): string {
  const txnMin = minIsoDate(txn.date, walkedTxn.date);
  return earliestDate === emptyEarliest ? txnMin : minIsoDate(earliestDate, txnMin);
}

async function loadManualApplyRuleScope(
  groupsRepo: RuleGroupRepository,
  rulesRepo: RuleRepository,
  userId: string,
  mode: ApplyManualInput["mode"]
): Promise<{
  groups: TransactionRuleGroup[];
  rulesByGroupId: Map<string, TransactionRule[]>;
}> {
  if (mode.type === "rule") {
    const rule = await rulesRepo.findById(userId, mode.ruleId);
    if (!rule) {
      throw new EntityNotFoundError("Rule", mode.ruleId);
    }
    const group = await groupsRepo.findById(userId, rule.groupId);
    if (!group) {
      throw new EntityNotFoundError("RuleGroup", rule.groupId);
    }
    const activeGroup = group.withUpdates({ active: true, updatedAt: group.updatedAt });
    const activeRule = rule.withUpdates({ active: true, updatedAt: rule.updatedAt });
    return {
      groups: [activeGroup],
      rulesByGroupId: new Map([[group.id, [activeRule]]]),
    };
  }

  const group = await groupsRepo.findById(userId, mode.groupId);
  if (!group) {
    throw new EntityNotFoundError("RuleGroup", mode.groupId);
  }
  const activeGroup = group.withUpdates({ active: true, updatedAt: group.updatedAt });
  const childRules = await rulesRepo.findByFilters({
    userId,
    groupId: group.id,
    active: true,
  });
  return {
    groups: [activeGroup],
    rulesByGroupId: new Map([[group.id, childRules]]),
  };
}

async function loadManualApplyEvalMaps(
  accounts: AccountRepository,
  categories: CategoryRepository,
  tags: TagRepository,
  userId: string
): Promise<ManualApplyEvalMaps> {
  const [accountRows, categoryRows, tagRows] = await Promise.all([
    accounts.findByFilters({ userId }),
    categories.findByFilters({ userId }),
    tags.findByFilters({ userId }),
  ]);
  return {
    accountsById: new Map(accountRows.map((row) => [row.id, row])),
    categoriesById: new Map(categoryRows.map((row) => [row.id, row])),
    tagsById: new Map(tagRows.map((row) => [row.id, row])),
    systemByType: buildSystemByType(accountRows),
  };
}

async function processManualApplyTransaction(
  txn: Transaction,
  userId: string,
  dryRun: boolean,
  emptyEarliest: string,
  groups: TransactionRuleGroup[],
  rulesByGroupId: Map<string, TransactionRule[]>,
  evalMaps: ManualApplyEvalMaps,
  state: ManualApplyRunState,
  transactions: TransactionRepository
): Promise<void> {
  const context = buildEvalContext(
    txn,
    evalMaps.accountsById,
    evalMaps.categoriesById,
    evalMaps.tagsById,
    evalMaps.systemByType
  );
  if (!context) {
    state.warnings.push("Account was not found.");
    state.skipped += 1;
    return;
  }

  const walked = walkRules(txn, groups, rulesByGroupId, context);
  state.warnings.push(...walked.warnings);

  if (!walked.matched) {
    state.skipped += 1;
    return;
  }

  state.matched += 1;
  unionAccountIds(txn, walked.transaction, state.accountIdSet);
  state.earliestDate = bumpManualApplyEarliestDate(
    emptyEarliest,
    state.earliestDate,
    txn,
    walked.transaction
  );

  if (walked.deleted) {
    state.deleted += 1;
    if (!dryRun) {
      await transactions.delete(userId, txn.id);
    }
    return;
  }

  if (walked.transaction !== txn) {
    state.mutated += 1;
    if (!dryRun) {
      await transactions.save(walked.transaction);
    }
  }
}

async function paginateManualApply(
  transactions: TransactionRepository,
  listFilters: TransactionFilters,
  shouldCancel: (() => boolean) | undefined,
  userId: string,
  dryRun: boolean,
  emptyEarliest: string,
  groups: TransactionRuleGroup[],
  rulesByGroupId: Map<string, TransactionRule[]>,
  evalMaps: ManualApplyEvalMaps,
  state: ManualApplyRunState
): Promise<ApplyManualResult | null> {
  let after: { date: string; createdAt: string; id: string } | null = null;

  while (true) {
    if (shouldCancel?.()) {
      return manualApplyResult(state, dryRun);
    }

    const page = await transactions.listByFiltersCursor(listFilters, after, MAX_RULES_APPLY_PAGE);

    for (const txn of page) {
      await processManualApplyTransaction(
        txn,
        userId,
        dryRun,
        emptyEarliest,
        groups,
        rulesByGroupId,
        evalMaps,
        state,
        transactions
      );
    }

    if (page.length < MAX_RULES_APPLY_PAGE) {
      break;
    }

    const last = page[page.length - 1];
    after = { date: last.date, createdAt: last.createdAt, id: last.id };
  }

  return null;
}

export class RuleEngineService {
  constructor(
    private readonly groups: RuleGroupRepository,
    private readonly rules: RuleRepository,
    private readonly transactions: TransactionRepository,
    private readonly accounts: AccountRepository,
    private readonly categories: CategoryRepository,
    private readonly tags: TagRepository
  ) {}

  /**
   * Runs on-create rules after rows are persisted (HTTP create, batch, or full CSV ingest).
   * Ingest calls this once on the combined persisted set, not per CSV line.
   */
  async applyOnCreate(userId: string, transactions: Transaction[]): Promise<ApplyOnCreateResult> {
    const emptyEarliest = Time.monthStartIso(1970, 1);
    if (transactions.length === 0) {
      return {
        rows: [],
        deletedIds: [],
        accountIds: [],
        earliestDate: emptyEarliest,
        warnings: [],
      };
    }

    const [groups, allRules, accountRows, categoryRows, tagRows] = await Promise.all([
      this.groups.findByFilters(
        { userId, active: true },
        { column: "sort_order", direction: "asc" }
      ),
      this.rules.findByFilters({ userId, active: true }),
      this.accounts.findByFilters({ userId }),
      this.categories.findByFilters({ userId }),
      this.tags.findByFilters({ userId }),
    ]);

    const onCreateRules = allRules.filter((rule) => rule.runOnCreate);
    if (onCreateRules.length === 0) {
      const accountIds = new Set<string>();
      let earliestDate = transactions[0].date;
      for (const txn of transactions) {
        accountIds.add(txn.sourceAccountId);
        accountIds.add(txn.destinationAccountId);
        earliestDate = minIsoDate(earliestDate, txn.date);
      }
      return {
        rows: transactions,
        deletedIds: [],
        accountIds: [...accountIds],
        earliestDate,
        warnings: [],
      };
    }

    const accountsById = new Map(accountRows.map((row) => [row.id, row]));
    const categoriesById = new Map(categoryRows.map((row) => [row.id, row]));
    const tagsById = new Map(tagRows.map((row) => [row.id, row]));
    const systemByType = buildSystemByType(accountRows);
    const rulesByGroupId = groupRulesByGroupId(onCreateRules);

    const rows: Transaction[] = [];
    const deletedIds: string[] = [];
    const accountIdSet = new Set<string>();
    const warnings: string[] = [];
    let earliestDate = transactions[0].date;

    for (const txn of transactions) {
      const context = buildEvalContext(txn, accountsById, categoriesById, tagsById, systemByType);
      if (!context) {
        warnings.push("Account was not found.");
        rows.push(txn);
        accountIdSet.add(txn.sourceAccountId);
        accountIdSet.add(txn.destinationAccountId);
        earliestDate = minIsoDate(earliestDate, txn.date);
        continue;
      }

      const walked = walkRules(txn, groups, rulesByGroupId, context);
      warnings.push(...walked.warnings);
      unionAccountIds(txn, walked.transaction, accountIdSet);
      earliestDate = minIsoDate(earliestDate, txn.date);
      earliestDate = minIsoDate(earliestDate, walked.transaction.date);

      if (walked.deleted) {
        await this.transactions.delete(userId, txn.id);
        deletedIds.push(txn.id);
        continue;
      }

      if (walked.transaction !== txn) {
        const saved = await this.transactions.save(walked.transaction);
        rows.push(saved);
        continue;
      }

      rows.push(txn);
    }

    return {
      rows,
      deletedIds,
      accountIds: [...accountIdSet],
      earliestDate,
      warnings,
    };
  }

  async testRule(
    userId: string,
    ruleId: string,
    snapshot: TestRuleSnapshot
  ): Promise<TestRuleResult> {
    const rule = await this.rules.findById(userId, ruleId);
    if (!rule) {
      throw new EntityNotFoundError("Rule", ruleId);
    }

    const txn = Transaction.create({
      id: crypto.randomUUID(),
      userId,
      date: snapshot.date,
      amount: snapshot.amount,
      sourceAccountId: snapshot.sourceAccountId,
      destinationAccountId: snapshot.destinationAccountId,
      description: snapshot.description,
      refNo: snapshot.refNo ?? null,
      importId: snapshot.importId ?? null,
      categoryId: snapshot.categoryId ?? null,
      subcategoryId: snapshot.subcategoryId ?? null,
      tagIds: snapshot.tagIds ?? [],
    });

    const [accountRows, categoryRows, tagRows] = await Promise.all([
      this.accounts.findByFilters({ userId }),
      this.categories.findByFilters({ userId }),
      this.tags.findByFilters({ userId }),
    ]);

    const accountsById = new Map(accountRows.map((row) => [row.id, row]));
    const categoriesById = new Map(categoryRows.map((row) => [row.id, row]));
    const tagsById = new Map(tagRows.map((row) => [row.id, row]));
    const systemByType = buildSystemByType(accountRows);

    const context = buildEvalContext(txn, accountsById, categoriesById, tagsById, systemByType);
    if (!context) {
      throw new ValidationError("Account was not found.");
    }

    if (!matchWhen(txn, rule.when, context)) {
      return { matched: false, actions: [], warnings: [] };
    }

    const applied = applyActions(txn, rule.actions, context);
    return {
      matched: true,
      actions: rule.actions,
      warnings: applied.warnings,
    };
  }

  async applyManual(input: ApplyManualInput): Promise<ApplyManualResult> {
    const { userId, mode, filters, dryRun, shouldCancel } = input;
    const emptyEarliest = Time.monthStartIso(1970, 1);

    const { groups, rulesByGroupId } = await loadManualApplyRuleScope(
      this.groups,
      this.rules,
      userId,
      mode
    );
    const evalMaps = await loadManualApplyEvalMaps(
      this.accounts,
      this.categories,
      this.tags,
      userId
    );

    const state: ManualApplyRunState = {
      matched: 0,
      mutated: 0,
      deleted: 0,
      skipped: 0,
      accountIdSet: new Set<string>(),
      warnings: [],
      earliestDate: emptyEarliest,
    };

    const cancelled = await paginateManualApply(
      this.transactions,
      { ...filters, userId },
      shouldCancel,
      userId,
      dryRun,
      emptyEarliest,
      groups,
      rulesByGroupId,
      evalMaps,
      state
    );
    if (cancelled) {
      return cancelled;
    }

    return manualApplyResult(state, dryRun);
  }
}
