export type SeriesBucket = "day" | "week" | "month";

export type DashboardNamedAmount = {
  id: string | null;
  name: string;
  parentId: string | null;
  amount: number;
  txnCount: number;
};

export type DashboardAccountAmount = {
  accountId: string;
  label: string;
  accountType: string;
  amount: number;
  txnCount: number;
};

export type DashboardSeriesPoint = {
  bucketStart: string;
  income: number;
  spend: number;
};

export type DashboardCashflow = {
  income: number;
  spend: number;
  net: number;
  transfer: number;
  incomeCount: number;
  spendCount: number;
  transferCount: number;
  uncategorizedSpend: number;
  uncategorizedSpendCount: number;
  unknownCounterpart: number;
  unknownCounterpartCount: number;
};

export type DashboardNetWorth = {
  opening: number;
  closing: number;
  change: number;
  byType: { accountType: string; amount: number }[];
};

export type DashboardRangeAggregates = {
  cashflow: Omit<DashboardCashflow, "net">;
  spendByCategory: DashboardNamedAmount[];
  spendBySubcategory: DashboardNamedAmount[];
  spendByAccount: DashboardAccountAmount[];
  incomeByCategory: DashboardNamedAmount[];
  series: DashboardSeriesPoint[];
};

export type DashboardSnapshot = {
  period: { from: string; to: string; bucket: SeriesBucket };
  cashflow: DashboardCashflow;
  spendByCategory: DashboardNamedAmount[];
  spendBySubcategory: DashboardNamedAmount[];
  spendByAccount: DashboardAccountAmount[];
  incomeByCategory: DashboardNamedAmount[];
  series: DashboardSeriesPoint[];
  netWorth: DashboardNetWorth;
};
