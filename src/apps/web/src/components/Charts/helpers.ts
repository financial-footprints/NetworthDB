export type ChartSeriesItem = {
  id?: string | null;
  name: string;
  value: number;
};

export const CHART_DEFAULT_HEIGHT = 220;

const CHART_COLORS = [
  "#1a5fb4",
  "#26a269",
  "#e5a50a",
  "#c01c28",
  "#813d9c",
  "#0d7377",
  "#f57900",
  "#5e5c64",
] as const;

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
