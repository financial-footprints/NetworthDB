import { CashflowTrendChart } from "@web/components/Charts/CashflowTrendChart";
import { DonutChart } from "@web/components/Charts/DonutChart";
import { HorizontalBarChart } from "@web/components/Charts/HorizontalBarChart";
import type { ChartSeriesItem } from "@web/components/Charts/helpers";
import { StatStrip } from "@web/routes/home/_parts/StatStrip";
import type { DashboardSnapshotApi } from "@web/utils/api/routes/dashboard/types";
import { formatIntegerAsRupee } from "@web/utils/money";
import { useEffect, useMemo, useState } from "react";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  bank: "Banks",
  credit_card: "Credit Cards",
  loan: "Loans",
  stocks: "Stocks",
  bonds: "Bonds",
  mutual_funds: "Mutual Funds",
};

function categoryKey(id: string | null): string {
  return id ?? "uncategorized";
}

type DashboardViewProps = {
  snapshot: DashboardSnapshotApi;
};

export function Dashboard({ snapshot }: DashboardViewProps) {
  const spendDonut = useMemo(
    () =>
      snapshot.spendByCategory.map((row) => ({
        id: row.id,
        name: row.name,
        value: row.amount,
      })),
    [snapshot.spendByCategory]
  );

  const incomeDonut = useMemo(
    () =>
      snapshot.incomeByCategory.map((row) => ({
        id: row.id,
        name: row.name,
        value: row.amount,
      })),
    [snapshot.incomeByCategory]
  );

  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string>(() =>
    categoryKey(snapshot.spendByCategory[0]?.id ?? null)
  );

  useEffect(() => {
    setSelectedCategoryKey(categoryKey(snapshot.spendByCategory[0]?.id ?? null));
  }, [snapshot.spendByCategory]);

  const subcategoryBars = useMemo(() => {
    if (selectedCategoryKey === "uncategorized") {
      const row = snapshot.spendByCategory.find((item) => item.id === null);
      if (!row || row.amount === 0) {
        return [];
      }
      return [{ name: "Uncategorized", value: row.amount }];
    }
    const parentId = snapshot.spendByCategory.find(
      (item) => categoryKey(item.id) === selectedCategoryKey
    )?.id;
    if (!parentId) {
      return [];
    }
    return snapshot.spendBySubcategory
      .filter((row) => row.parentId === parentId)
      .map((row) => ({ name: row.name, value: row.amount }));
  }, [selectedCategoryKey, snapshot.spendByCategory, snapshot.spendBySubcategory]);

  const spendByAccount = useMemo(
    () =>
      snapshot.spendByAccount.map((row) => ({
        name: row.label,
        value: row.amount,
      })),
    [snapshot.spendByAccount]
  );

  const netWorthByType = useMemo(
    () =>
      snapshot.netWorth.byType.map((row) => ({
        name: ACCOUNT_TYPE_LABELS[row.accountType] ?? row.accountType,
        value: row.amount,
      })),
    [snapshot.netWorth.byType]
  );

  const trendData = useMemo(
    () =>
      snapshot.series.map((row) => ({
        bucketStart: row.bucketStart,
        income: row.income,
        spend: row.spend,
      })),
    [snapshot.series]
  );

  const handleSliceClick = (item: ChartSeriesItem) => {
    setSelectedCategoryKey(categoryKey(item.id ?? null));
  };

  const change = snapshot.netWorth.change;
  const changeClass = change < 0 ? "text-red-700" : "text-emerald-700";

  return (
    <div className="space-y-8">
      <StatStrip cashflow={snapshot.cashflow} />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Cashflow Over Time</h2>
        <CashflowTrendChart data={trendData} ariaLabel="Income and Spend Over the Active Period" />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Spending</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <DonutChart
            data={spendDonut}
            ariaLabel="Spend by Category"
            emptyMessage="No spending in this period."
            onSliceClick={handleSliceClick}
          />
          <HorizontalBarChart
            data={subcategoryBars}
            ariaLabel="Spend by Subcategory"
            emptyMessage={
              selectedCategoryKey === "uncategorized"
                ? "No subcategories for uncategorized spend."
                : "No subcategories in this period."
            }
          />
        </div>
        <div className="mt-4">
          <HorizontalBarChart
            data={spendByAccount}
            ariaLabel="Spend by Account"
            emptyMessage="No spending in this period."
            height={260}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Earnings</h2>
        <DonutChart
          data={incomeDonut}
          ariaLabel="Income by Category"
          emptyMessage="No income in this period."
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Net Worth</h2>
        <dl className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-sm border border-slate-200 bg-white px-4 py-3">
            <dt className="text-xs text-slate-500">Opening</dt>
            <dd className="text-xl font-semibold tabular-nums text-slate-900">
              ₹{formatIntegerAsRupee(snapshot.netWorth.opening)}
            </dd>
          </div>
          <div className="rounded-sm border border-slate-200 bg-white px-4 py-3">
            <dt className="text-xs text-slate-500">Closing</dt>
            <dd className="text-xl font-semibold tabular-nums text-slate-900">
              ₹{formatIntegerAsRupee(snapshot.netWorth.closing)}
            </dd>
          </div>
          <div className="rounded-sm border border-slate-200 bg-white px-4 py-3">
            <dt className="text-xs text-slate-500">Change</dt>
            <dd className={`text-xl font-semibold tabular-nums ${changeClass}`}>
              ₹{formatIntegerAsRupee(change)}
            </dd>
          </div>
        </dl>
        <HorizontalBarChart
          data={netWorthByType}
          ariaLabel="Net Worth by Account Type at Period End"
          emptyMessage="No instrument balances."
          valueLabel="Balance"
        />
      </section>
    </div>
  );
}
