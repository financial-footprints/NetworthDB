import type { SchemaTableDoc } from "@database/operations/describe/index";
import { accounts } from "@database/schema/accounts";
import { transactionCategories } from "@database/schema/transactions/categories";
import { transactionImports } from "@database/schema/transactions/imports";
import { users } from "@database/schema/users/index";
import { sql } from "drizzle-orm";
import { bigint, check, date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const transactionsSchemaDoc: SchemaTableDoc = {
  summary:
    "Ledger facts: positive amount (rupees × 100) from source_account_id to destination_account_id.",
  notes: [
    "No credit/debit columns; pair_is_spend/income/transfer semantics come from account types.",
  ],
};

/** Tier 3 description/ref_no; tier 3 date and amount (ADR-006). */
export const transactions = pgTable(
  "transactions",
  {
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceAccountId: uuid("source_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    destinationAccountId: uuid("destination_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => transactionCategories.id, {
      onDelete: "set null",
    }),
    subcategoryId: uuid("subcategory_id").references(() => transactionCategories.id, {
      onDelete: "set null",
    }),
    importId: uuid("import_id").references(() => transactionImports.id, {
      onDelete: "cascade",
    }),
    description: text("description").notNull(),
    refNo: text("ref_no"),
  },
  (table) => [
    check("transactions_amount_positive", sql`${table.amount} > 0`),
    check(
      "transactions_source_destination_distinct",
      sql`${table.sourceAccountId} <> ${table.destinationAccountId}`
    ),
    check(
      "transactions_subcategory_requires_category",
      sql`${table.subcategoryId} is null OR ${table.categoryId} is not null`
    ),
    index("transactions_source_date_idx").on(
      table.sourceAccountId,
      table.date,
      table.createdAt,
      table.id
    ),
    index("transactions_destination_date_idx").on(
      table.destinationAccountId,
      table.date,
      table.createdAt,
      table.id
    ),
    index("transactions_user_date_idx").on(table.userId, table.date),
    index("transactions_user_category_id_idx").on(table.userId, table.categoryId),
    index("transactions_user_subcategory_id_idx").on(table.userId, table.subcategoryId),
    index("transactions_import_id_idx").on(table.importId),
    index("transactions_description_words_idx").using(
      "gin",
      sql`string_to_array(lower(${table.description}), ' ')`
    ),
    index("transactions_ref_no_words_idx").using(
      "gin",
      sql`string_to_array(lower(coalesce(${table.refNo}, '')), ' ')`
    ),
  ]
);
