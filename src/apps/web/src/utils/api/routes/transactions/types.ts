import type {
  balanceSchema,
  createTransactionReqSchema,
  patchTransactionReqSchema,
  rangeSummarySchema,
  systemAccountsSchema,
  transactionSchema,
} from "@ndb/platform";
import type { z } from "zod";

export type TransactionApi = z.infer<typeof transactionSchema>["data"];

export type TransactionPartyApi = TransactionApi["source"];

export type RangeSummaryApi = z.infer<typeof rangeSummarySchema>["data"];

export type CreateTransactionBody = z.infer<typeof createTransactionReqSchema>;

export type UpdateTransactionBody = z.infer<typeof patchTransactionReqSchema>;

export type SystemAccountApi = z.infer<typeof systemAccountsSchema>["data"]["items"][number];

export type BalanceAsOfApi = z.infer<typeof balanceSchema>["data"];
