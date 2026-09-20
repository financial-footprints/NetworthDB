import { Empty } from "@web/components/Charts/Empty";
import { CHART_DEFAULT_HEIGHT } from "@web/components/Charts/helpers";
import { formatIntegerAsRupee } from "@web/utils/money";
import { formatDisplayDateCompact } from "@web/utils/time";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type CashflowTrendPoint = {
  bucketStart: string;
  income: number;
  spend: number;
};

type CashflowTrendChartProps = {
  data: CashflowTrendPoint[];
  emptyMessage?: string;
  height?: number;
  ariaLabel: string;
  className?: string;
};

export function CashflowTrendChart({
  data,
  emptyMessage = "No activity in this period.",
  height = CHART_DEFAULT_HEIGHT + 40,
  ariaLabel,
  className,
}: CashflowTrendChartProps) {
  const hasActivity = data.some((row) => row.income !== 0 || row.spend !== 0);
  if (!hasActivity) {
    return <Empty message={emptyMessage} height={height} className={className} />;
  }

  const chartData = data.map((row) => ({
    bucketStart: row.bucketStart,
    income: row.income,
    spend: row.spend,
  }));

  return (
    <figure
      className={`rounded-sm border border-slate-200 bg-white px-3 py-2 ${className ?? ""}`}
      aria-label={ariaLabel}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="bucketStart"
            tick={{ fontSize: 11, fill: "#475569" }}
            tickFormatter={(value) => formatDisplayDateCompact(String(value))}
          />
          <YAxis tick={{ fontSize: 11, fill: "#475569" }} />
          <Tooltip
            formatter={(value) => `₹${formatIntegerAsRupee(Number(value ?? 0))}`}
            labelFormatter={(label) => formatDisplayDateCompact(String(label))}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="income"
            name="Income"
            stroke="#26a269"
            fill="#26a269"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="spend"
            name="Spend"
            stroke="#c01c28"
            fill="#c01c28"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  );
}
