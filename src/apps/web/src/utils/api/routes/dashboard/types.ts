type DashboardNamedAmountApi = {
  id: string | null;
  name: string;
  parentId: string | null;
  amount: number;
  txnCount: number;
};

type DashboardAccountAmountApi = {
  accountId: string;
  label: string;
  accountType: string;
  amount: number;
  txnCount: number;
};

type DashboardSeriesPointApi = {
  bucketStart: string;
  income: number;
  spend: number;
};

export type DashboardSnapshotApi = {
  period: {
    from: string;
    to: string;
    bucket: "day" | "week" | "month";
  };
  cashflow: {
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
  spendByCategory: DashboardNamedAmountApi[];
  spendBySubcategory: DashboardNamedAmountApi[];
  spendByAccount: DashboardAccountAmountApi[];
  incomeByCategory: DashboardNamedAmountApi[];
  series: DashboardSeriesPointApi[];
  netWorth: {
    opening: number;
    closing: number;
    change: number;
    byType: Array<{ accountType: string; amount: number }>;
  };
};
