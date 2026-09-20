import type { DashboardSnapshot } from "@ndb/core";
import { dashboardSnapshotSchema } from "@ndb/platform";

export function serializeDashboardSnapshot(snapshot: DashboardSnapshot) {
  return dashboardSnapshotSchema.parse({
    data: {
      period: {
        from: snapshot.period.from,
        to: snapshot.period.to,
        bucket: snapshot.period.bucket,
      },
      cashflow: {
        income: snapshot.cashflow.income,
        spend: snapshot.cashflow.spend,
        net: snapshot.cashflow.net,
        transfer: snapshot.cashflow.transfer,
        incomeCount: snapshot.cashflow.incomeCount,
        spendCount: snapshot.cashflow.spendCount,
        transferCount: snapshot.cashflow.transferCount,
        uncategorizedSpend: snapshot.cashflow.uncategorizedSpend,
        uncategorizedSpendCount: snapshot.cashflow.uncategorizedSpendCount,
        unknownCounterpart: snapshot.cashflow.unknownCounterpart,
        unknownCounterpartCount: snapshot.cashflow.unknownCounterpartCount,
      },
      spendByCategory: snapshot.spendByCategory.map((row) => ({
        id: row.id,
        name: row.name,
        parentId: row.parentId,
        amount: row.amount,
        txnCount: row.txnCount,
      })),
      spendBySubcategory: snapshot.spendBySubcategory.map((row) => ({
        id: row.id,
        name: row.name,
        parentId: row.parentId,
        amount: row.amount,
        txnCount: row.txnCount,
      })),
      spendByAccount: snapshot.spendByAccount.map((row) => ({
        accountId: row.accountId,
        label: row.label,
        accountType: row.accountType,
        amount: row.amount,
        txnCount: row.txnCount,
      })),
      incomeByCategory: snapshot.incomeByCategory.map((row) => ({
        id: row.id,
        name: row.name,
        parentId: row.parentId,
        amount: row.amount,
        txnCount: row.txnCount,
      })),
      series: snapshot.series.map((row) => ({
        bucketStart: row.bucketStart,
        income: row.income,
        spend: row.spend,
      })),
      netWorth: {
        opening: snapshot.netWorth.opening,
        closing: snapshot.netWorth.closing,
        change: snapshot.netWorth.change,
        byType: snapshot.netWorth.byType.map((row) => ({
          accountType: row.accountType,
          amount: row.amount,
        })),
      },
    },
  });
}
