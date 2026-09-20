import type { SchemaTableDoc } from "@database/operations/describe/index";
import { transactionRuleGroups } from "@database/schema/transactions/rule-groups";
import { users } from "@database/schema/users/index";
import {
  RULE_ACTION_TYPES,
  RULE_TRIGGER_TYPES,
  type RuleAction,
  type RuleExpression,
} from "@ndb/core";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const transactionRulesSchemaDoc: SchemaTableDoc = {
  summary: "JSONB triggers and actions evaluated on ingest or via rules_apply jobs.",
  jsonShapes: {
    triggers: `RuleExpression (and/or groups or a trigger leaf; types include ${RULE_TRIGGER_TYPES.slice(0, 5).join(", ")}, …)`,
    actions: `RuleAction[] (type one of: ${RULE_ACTION_TYPES.slice(0, 5).join(", ")}, …)`,
  },
};

/** ADR-004 tier 3 plaintext; server-side match after ingest (ADR-009). */
export const transactionRules = pgTable(
  "transaction_rules",
  {
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => transactionRuleGroups.id, { onDelete: "cascade" }),
    active: boolean("active").notNull().default(true),
    stopProcessing: boolean("stop_processing").notNull().default(false),
    runOnCreate: boolean("run_on_create").notNull().default(true),
    title: text("title").notNull(),
    description: text("description"),
    triggers: jsonb("triggers").$type<RuleExpression>().notNull(),
    actions: jsonb("actions").$type<RuleAction[]>().notNull(),
  },
  (table) => [
    index("transaction_rules_user_id_idx").on(table.userId),
    index("transaction_rules_group_id_idx").on(table.groupId),
  ]
);
