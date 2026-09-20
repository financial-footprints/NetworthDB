import type { SchemaTableDoc } from "@database/operations/describe/index";
import { accounts } from "@database/schema/accounts";
import { users } from "@database/schema/users/index";
import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const transactionImportsSchemaDoc: SchemaTableDoc = {
  summary: "Bulk-replace import batch header linked to transactions.import_id.",
};

/** Tier 3: batch header for bulk replace; no file paths (ADR-006). */
export const transactionImports = pgTable(
  "transaction_imports",
  {
    createdAt: timestamp("created_at").notNull(),
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
  },
  (table) => [index("transaction_imports_account_id_idx").on(table.accountId)]
);
