import type { StatementTransactions } from "@ndb/core";
import type { AccountTransactions as NativeStatementTransactions } from "../../native.d.ts";

export const statementTransactions = {
  toDomain: (rows: NativeStatementTransactions[]): StatementTransactions[] => {
    return rows.map((entry) => ({
      period: entry.period,
      isAnnual: entry.isAnnual,
      rows: entry.rows.map((row) => ({
        date: row.date,
        description: row.description,
        refNo: row.refNo,
        credited: row.credited,
        debited: row.debited,
        sourceFile: row.sourceFile,
      })),
    }));
  },
};
