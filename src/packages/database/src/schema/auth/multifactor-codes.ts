import { users } from "@database/schema/users/index";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const authMultifactorCodes = pgTable(
  "auth_multifactor_codes",
  {
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull(),
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
  },
  (table) => [
    uniqueIndex("auth_multifactor_codes_user_hash_unique").on(table.userId, table.codeHash),
  ]
);
