import { bytea } from "@database/schema/types";
import { users } from "@database/schema/users/index";
import { ACCOUNT_TYPES } from "@ndb/core";
import { date, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const accountTypeEnum = pgEnum("account_type", ACCOUNT_TYPES);

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
    secrets: bytea("secrets").notNull(),
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)]
);
