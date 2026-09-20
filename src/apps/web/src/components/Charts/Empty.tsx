import { CHART_DEFAULT_HEIGHT } from "@web/components/Charts/helpers";

type ChartEmptyStateProps = {
  message: string;
  height?: number;
  className?: string;
};

export function Empty({ message, height = CHART_DEFAULT_HEIGHT, className }: ChartEmptyStateProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-sm border border-slate-200 bg-white px-4 text-sm text-slate-500 ${className ?? ""}`}
      style={{ minHeight: height }}
    >
      {message}
    </div>
  );
}
