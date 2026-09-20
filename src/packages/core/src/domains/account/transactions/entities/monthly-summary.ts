export type MonthlySummary = {
  id: string;
  userId: string;
  accountId: string;
  year: number;
  month: number;
  periodStart: string;
  periodEnd: string;
  amountCredit: number;
  amountDebit: number;
  amountOpening: number;
  amountClosing: number;
  txnCount: number;
  createdAt: string;
  updatedAt: string;
};
