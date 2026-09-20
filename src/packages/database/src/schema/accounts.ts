import type { SchemaTableDoc } from "@database/operations/describe/index";
import { bytea } from "@database/schema/types";
import { users } from "@database/schema/users/index";
import { ACCOUNT_TYPES } from "@ndb/core";
import { sql } from "drizzle-orm";
import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const accountTypeEnum = pgEnum("account_type", ACCOUNT_TYPES);

export const accountsSchemaDoc: SchemaTableDoc = {
  summary: "Financial instruments and four system accounts per user.",
  omittedColumns: [{ name: "secrets", reason: "NWENC1 account secrets are not selectable" }],
  columnEnums: { account_type: ACCOUNT_TYPES },
  notes: ["System account types: unknown, revenue, expense, tumbler (one per user)."],
};

export const accounts = pgTable(
  "accounts",
  {
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    openingDate: date("opening_date", { mode: "string" }).notNull(),
    closingDate: date("closing_date", { mode: "string" }),
    accountType: accountTypeEnum("account_type").notNull(),
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bank: text("bank").notNull(),
    variant: text("variant"),
    label: text("label").notNull(),
    accountNumber: text("account_number").notNull(),
    secrets: bytea("secrets"),
  },
  (table) => [
    index("accounts_user_id_idx").on(table.userId),
    uniqueIndex("accounts_user_system_type_uidx")
      .on(table.userId, table.accountType)
      .where(sql`${table.accountType} in ('unknown', 'revenue', 'expense', 'tumbler')`),
  ]
);
