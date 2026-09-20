import type { SchemaTableDoc } from "@database/operations/describe/index";
import { transactions } from "@database/schema/transactions/transactions";
import { users } from "@database/schema/users/index";
import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const transactionTagsSchemaDoc: SchemaTableDoc = {
  summary: "Flat tags per user; unique name per user (case-insensitive).",
};

export const transactionTagAssignmentsSchemaDoc: SchemaTableDoc = {
  summary: "Many-to-many between transactions and tags (no user_id; scope via transaction RLS).",
};

/** ADR-004 tier 3 plaintext; unique per user for list/filter (ADR-007). */
export const transactionTags = pgTable(
  "transaction_tags",
  {
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (table) => [
    index("transaction_tags_user_id_idx").on(table.userId),
    uniqueIndex("transaction_tags_user_name_uidx").on(table.userId, sql`lower(${table.name})`),
  ]
);

export const transactionTagAssignments = pgTable(
  "transaction_tag_assignments",
  {
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => transactionTags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.transactionId, table.tagId] }),
    index("transaction_tag_assignments_tag_id_idx").on(table.tagId),
  ]
);
