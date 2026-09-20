import type { SchemaTableDoc } from "@database/operations/describe/index";
import { users } from "@database/schema/users/index";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const transactionCategoriesSchemaDoc: SchemaTableDoc = {
  summary: "Two-level category tree (parent_id null for roots).",
  notes: ["Names are unique per user (case-insensitive) within parent scope."],
};

/** ADR-004 tier 3 plaintext; unique per user for list/filter (ADR-007). */
export const transactionCategories = pgTable(
  "transaction_categories",
  {
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => transactionCategories.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
  },
  (table) => [
    index("transaction_categories_user_id_idx").on(table.userId),
    uniqueIndex("transaction_categories_user_root_name_uidx")
      .on(table.userId, sql`lower(${table.name})`)
      .where(sql`${table.parentId} is null`),
    uniqueIndex("transaction_categories_user_child_name_uidx")
      .on(table.userId, table.parentId, sql`lower(${table.name})`)
      .where(sql`${table.parentId} is not null`),
  ]
);
