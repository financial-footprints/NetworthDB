import { users } from "@database/schema/users/users";
import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const authMfaCodes = pgTable(
  "auth_mfacodes",
  {
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull(),
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
  },
  (table) => [uniqueIndex("auth_mfacodes_user_hash_unique").on(table.userId, table.codeHash)]
);
