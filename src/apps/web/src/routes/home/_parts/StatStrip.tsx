import type { DashboardSnapshotApi } from "@web/utils/api/routes/dashboard/types";
import { formatIntegerAsRupee } from "@web/utils/money";

type StatItem = {
  label: string;
  value: string;
  valueClassName?: string;
};

export function StatStrip({ cashflow }: { cashflow: DashboardSnapshotApi["cashflow"] }) {
  const items: StatItem[] = [
    { label: "Income", value: `₹${formatIntegerAsRupee(cashflow.income)}` },
    { label: "Spend", value: `₹${formatIntegerAsRupee(cashflow.spend)}` },
    {
      label: "Net",
      value: `₹${formatIntegerAsRupee(cashflow.net)}`,
      valueClassName: cashflow.net < 0 ? "text-red-700" : "text-emerald-700",
    },
    { label: "Transfers", value: `₹${formatIntegerAsRupee(cashflow.transfer)}` },
    {
      label: "Uncategorized Spend",
      value: `₹${formatIntegerAsRupee(cashflow.uncategorizedSpend)}`,
    },
    { label: "Still on Unknown", value: `₹${formatIntegerAsRupee(cashflow.unknownCounterpart)}` },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-0 rounded-sm border border-slate-200 bg-white px-4 py-4"
        >
          <dt className="text-xs font-medium leading-snug text-slate-500">{item.label}</dt>
          <dd
            className={`mt-1 text-2xl font-semibold tabular-nums leading-none text-slate-900 ${item.valueClassName ?? ""}`}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
