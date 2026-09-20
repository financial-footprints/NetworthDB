import type { SchemaTableDoc } from "@database/operations/describe/index";
import { accounts } from "@database/schema/accounts";
import { users } from "@database/schema/users/index";
import {
  bigint,
  date,
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const transactionsMonthlySummarySchemaDoc: SchemaTableDoc = {
  summary: "Per-account monthly credits, debits, opening/closing balances, and txn counts.",
  notes: ["All amount_* columns are rupees × 100 (bigint)."],
};

/** Tier 3 aggregates for fast range queries (ADR-006). */
export const transactionsMonthlySummary = pgTable(
  "transactions_monthly_summary",
  {
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    amountCredit: bigint("amount_credit", { mode: "number" }).notNull(),
    amountDebit: bigint("amount_debit", { mode: "number" }).notNull(),
    amountOpening: bigint("amount_opening", { mode: "number" }).notNull(),
    amountClosing: bigint("amount_closing", { mode: "number" }).notNull(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    txnCount: integer("txn_count").notNull(),
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
  },
  (table) => [
    unique("transactions_monthly_summary_account_year_month_unique").on(
      table.accountId,
      table.year,
      table.month
    ),
    index("transactions_monthly_summary_user_year_month_idx").on(
      table.userId,
      table.year,
      table.month
    ),
  ]
);
