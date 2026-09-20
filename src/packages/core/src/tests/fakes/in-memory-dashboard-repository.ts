import {
  classifyDashboardMovement,
  seriesBucketStartForDate,
  sortDashboardAccountAmounts,
  sortDashboardNamedAmounts,
} from "@core/domains/account/dashboard/helpers";
import type { DashboardRepository } from "@core/domains/account/dashboard/repositories/dashboard-repository";
import type { DashboardRangeAggregates, SeriesBucket } from "@core/domains/account/dashboard/types";
import type { Account } from "@core/domains/account/entities/account";
import type { AccountRepository } from "@core/domains/account/repositories/account-repository";
import type { Category } from "@core/domains/account/taxonomy/entities/category";
import type { CategoryRepository } from "@core/domains/account/taxonomy/repositories/category-repository";
import type { Transaction } from "@core/domains/account/transactions/entities/transaction";
import type { TransactionRepository } from "@core/domains/account/transactions/repositories/transaction-repository";

type NamedKey = string;

type DashboardAggregateState = {
  income: number;
  spend: number;
  transfer: number;
  incomeCount: number;
  spendCount: number;
  transferCount: number;
  uncategorizedSpend: number;
  uncategorizedSpendCount: number;
  unknownCounterpart: number;
  unknownCounterpartCount: number;
  spendCategory: Map<
    NamedKey,
    { id: string | null; name: string; parentId: string | null; amount: number; txnCount: number }
  >;
  spendSubcategory: Map<
    NamedKey,
    { id: string | null; name: string; parentId: string | null; amount: number; txnCount: number }
  >;
  spendAccount: Map<
    string,
    { accountId: string; label: string; accountType: string; amount: number; txnCount: number }
  >;
  incomeCategory: Map<
    NamedKey,
    { id: string | null; name: string; parentId: string | null; amount: number; txnCount: number }
  >;
  seriesMap: Map<string, { bucketStart: string; income: number; spend: number }>;
};

function namedKey(id: string | null, name: string, parentId: string | null): NamedKey {
  return `${id ?? "null"}:${name}:${parentId ?? "null"}`;
}

function createDashboardAggregateState(): DashboardAggregateState {
  return {
    income: 0,
    spend: 0,
    transfer: 0,
    incomeCount: 0,
    spendCount: 0,
    transferCount: 0,
    uncategorizedSpend: 0,
    uncategorizedSpendCount: 0,
    unknownCounterpart: 0,
    unknownCounterpartCount: 0,
    spendCategory: new Map(),
    spendSubcategory: new Map(),
    spendAccount: new Map(),
    incomeCategory: new Map(),
    seriesMap: new Map(),
  };
}

function accumulateSpend(
  txn: Transaction,
  source: Account,
  dest: Account,
  categoryMap: Map<string, Category>,
  state: DashboardAggregateState,
  seriesRow: { bucketStart: string; income: number; spend: number }
): void {
  state.spend += txn.amount;
  state.spendCount += 1;
  seriesRow.spend += txn.amount;
  if (txn.categoryId === null) {
    state.uncategorizedSpend += txn.amount;
    state.uncategorizedSpendCount += 1;
  }
  if (dest.accountType === "unknown") {
    state.unknownCounterpart += txn.amount;
    state.unknownCounterpartCount += 1;
  }

  const catId = txn.categoryId;
  const catName =
    catId === null ? "Uncategorized" : (categoryMap.get(catId)?.name ?? "Uncategorized");
  const catKey = namedKey(catId, catName, null);
  const catRow = state.spendCategory.get(catKey) ?? {
    id: catId,
    name: catName,
    parentId: null,
    amount: 0,
    txnCount: 0,
  };
  catRow.amount += txn.amount;
  catRow.txnCount += 1;
  state.spendCategory.set(catKey, catRow);

  if (catId !== null) {
    const subId = txn.subcategoryId;
    const subName =
      subId === null ? "No subcategory" : (categoryMap.get(subId)?.name ?? "No subcategory");
    const subKey = namedKey(subId, subName, catId);
    const subRow = state.spendSubcategory.get(subKey) ?? {
      id: subId,
      name: subName,
      parentId: catId,
      amount: 0,
      txnCount: 0,
    };
    subRow.amount += txn.amount;
    subRow.txnCount += 1;
    state.spendSubcategory.set(subKey, subRow);
  }

  const acctRow = state.spendAccount.get(source.id) ?? {
    accountId: source.id,
    label: accountLabel(source),
    accountType: source.accountType,
    amount: 0,
    txnCount: 0,
  };
  acctRow.amount += txn.amount;
  acctRow.txnCount += 1;
  state.spendAccount.set(source.id, acctRow);
}

function accumulateIncome(
  txn: Transaction,
  source: Account,
  categoryMap: Map<string, Category>,
  state: DashboardAggregateState,
  seriesRow: { bucketStart: string; income: number; spend: number }
): void {
  state.income += txn.amount;
  state.incomeCount += 1;
  seriesRow.income += txn.amount;
  if (source.accountType === "unknown") {
    state.unknownCounterpart += txn.amount;
    state.unknownCounterpartCount += 1;
  }

  const catId = txn.categoryId;
  const catName =
    catId === null ? "Uncategorized" : (categoryMap.get(catId)?.name ?? "Uncategorized");
  const catKey = namedKey(catId, catName, null);
  const catRow = state.incomeCategory.get(catKey) ?? {
    id: catId,
    name: catName,
    parentId: null,
    amount: 0,
    txnCount: 0,
  };
  catRow.amount += txn.amount;
  catRow.txnCount += 1;
  state.incomeCategory.set(catKey, catRow);
}

function accumulateDashboardTransaction(
  txn: Transaction,
  accountMap: Map<string, Account>,
  categoryMap: Map<string, Category>,
  bucket: SeriesBucket,
  state: DashboardAggregateState
): void {
  const source = accountMap.get(txn.sourceAccountId);
  const dest = accountMap.get(txn.destinationAccountId);
  if (!source || !dest) {
    return;
  }

  const kind = classifyDashboardMovement(source.accountType, dest.accountType);
  if (kind === "other") {
    return;
  }

  const bucketStart = seriesBucketStartForDate(txn.date, bucket);
  const seriesRow = state.seriesMap.get(bucketStart) ?? {
    bucketStart,
    income: 0,
    spend: 0,
  };

  if (kind === "transfer") {
    state.transfer += txn.amount;
    state.transferCount += 1;
    state.seriesMap.set(bucketStart, seriesRow);
    return;
  }

  if (kind === "spend") {
    accumulateSpend(txn, source, dest, categoryMap, state, seriesRow);
  }
  if (kind === "income") {
    accumulateIncome(txn, source, categoryMap, state, seriesRow);
  }

  state.seriesMap.set(bucketStart, seriesRow);
}

export class InMemoryDashboardRepository implements DashboardRepository {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly accounts: AccountRepository,
    private readonly categories: CategoryRepository
  ) {}

  async aggregateRange(
    userId: string,
    from: string | undefined,
    to: string | undefined,
    bucket: SeriesBucket
  ): Promise<DashboardRangeAggregates> {
    const txns = await this.transactions.findByFilters({ userId, from, to });
    const accountList = await this.accounts.findByFilters({ userId });
    const accountMap = new Map(accountList.map((a) => [a.id, a]));
    const categoryList = await this.categories.findByFilters({ userId });
    const categoryMap = new Map(categoryList.map((c) => [c.id, c]));
    const state = createDashboardAggregateState();

    for (const txn of txns) {
      accumulateDashboardTransaction(txn, accountMap, categoryMap, bucket, state);
    }

    const series = [...state.seriesMap.values()].sort((a, b) =>
      a.bucketStart.localeCompare(b.bucketStart)
    );

    return {
      cashflow: {
        income: state.income,
        spend: state.spend,
        transfer: state.transfer,
        incomeCount: state.incomeCount,
        spendCount: state.spendCount,
        transferCount: state.transferCount,
        uncategorizedSpend: state.uncategorizedSpend,
        uncategorizedSpendCount: state.uncategorizedSpendCount,
        unknownCounterpart: state.unknownCounterpart,
        unknownCounterpartCount: state.unknownCounterpartCount,
      },
      spendByCategory: sortDashboardNamedAmounts([...state.spendCategory.values()]),
      spendBySubcategory: sortDashboardNamedAmounts([...state.spendSubcategory.values()]),
      spendByAccount: sortDashboardAccountAmounts([...state.spendAccount.values()]),
      incomeByCategory: sortDashboardNamedAmounts([...state.incomeCategory.values()]),
      series,
    };
  }
}

function accountLabel(account: Account): string {
  return account.label;
}
