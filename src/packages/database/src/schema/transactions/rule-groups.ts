import type { SchemaTableDoc } from "@database/operations/describe/index";
import { users } from "@database/schema/users/index";
import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const transactionRuleGroupsSchemaDoc: SchemaTableDoc = {
  summary: "Ordered groups of transaction rules per user.",
};

/** ADR-004 tier 3 plaintext; server-side match after ingest (ADR-009). */
export const transactionRuleGroups = pgTable(
  "transaction_rule_groups",
  {
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    active: boolean("active").notNull().default(true),
    title: text("title").notNull(),
    description: text("description"),
  },
  (table) => [index("transaction_rule_groups_user_id_idx").on(table.userId)]
);
