import { Empty } from "@web/components/Charts/Empty";
import {
  CHART_DEFAULT_HEIGHT,
  type ChartSeriesItem,
  chartColor,
} from "@web/components/Charts/helpers";
import { formatIntegerAsRupee } from "@web/utils/money";
import {
  Pie,
  PieChart,
  type PieSectorShapeProps,
  ResponsiveContainer,
  Sector,
  Tooltip,
} from "recharts";

function donutSector(props: PieSectorShapeProps) {
  return <Sector {...props} fill={chartColor(props.index ?? 0)} />;
}

type DonutChartProps = {
  data: ChartSeriesItem[];
  emptyMessage?: string;
  height?: number;
  ariaLabel: string;
  className?: string;
  onSliceClick?: (item: ChartSeriesItem) => void;
};

export function DonutChart({
  data,
  emptyMessage = "No data available.",
  height = CHART_DEFAULT_HEIGHT,
  ariaLabel,
  className,
  onSliceClick,
}: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (data.length === 0 || total === 0) {
    return <Empty message={emptyMessage} height={height} className={className} />;
  }

  return (
    <figure
      className={`flex gap-2 rounded-sm border border-slate-200 bg-white px-3 py-2 ${className ?? ""}`}
      aria-label={ariaLabel}
      style={{ height }}
    >
      <div className="min-h-0 w-3/4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={1}
              shape={donutSector}
              onClick={(_, index) => {
                const item = data[index];
                if (item && onSliceClick) {
                  onSliceClick(item);
                }
              }}
            />
            <Tooltip
              formatter={(value, name) => {
                const numeric = Number(value ?? 0);
                const share = total > 0 ? Math.round((numeric / total) * 100) : 0;
                return [`₹${formatIntegerAsRupee(numeric)} (${share}%)`, name];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex w-1/4 min-w-0 flex-col justify-center gap-1 py-0.5" aria-hidden="true">
        {data.map((entry, index) => (
          <li key={entry.id ?? entry.name} className="flex min-w-0 items-start gap-1">
            <span
              className="mt-0.5 size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: chartColor(index) }}
            />
            <span className="min-w-0 wrap-break-word text-[10px] leading-snug text-slate-600">
              {entry.name}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
