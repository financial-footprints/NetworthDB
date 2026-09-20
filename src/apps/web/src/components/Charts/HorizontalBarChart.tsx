import { Empty } from "@web/components/Charts/Empty";
import {
  CHART_DEFAULT_HEIGHT,
  type ChartSeriesItem,
  chartColor,
} from "@web/components/Charts/helpers";
import { formatIntegerAsRupee } from "@web/utils/money";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type HorizontalBarChartProps = {
  data: ChartSeriesItem[];
  emptyMessage?: string;
  height?: number;
  ariaLabel: string;
  valueLabel?: string;
  formatValue?: (value: number) => string;
  className?: string;
};

export function HorizontalBarChart({
  data,
  emptyMessage = "No data available.",
  height = CHART_DEFAULT_HEIGHT,
  ariaLabel,
  valueLabel = "Amount",
  formatValue,
  className,
}: HorizontalBarChartProps) {
  if (data.length === 0 || data.every((item) => item.value === 0)) {
    return <Empty message={emptyMessage} height={height} className={className} />;
  }

  const format = formatValue ?? ((value: number) => `₹${formatIntegerAsRupee(value)}`);

  return (
    <figure
      className={`flex flex-col rounded-sm border border-slate-200 bg-white px-3 py-2 ${className ?? ""}`}
      aria-label={ariaLabel}
      style={{ height }}
    >
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 4, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#475569" }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={96}
              tick={{ fontSize: 11, fill: "#475569" }}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => {
                const numeric = Number(value ?? 0);
                return [format(numeric), valueLabel];
              }}
            />
            <Bar dataKey="value" fill={chartColor(0)} radius={[0, 2, 2, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
