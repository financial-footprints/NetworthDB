import { users } from "@database/schema/users/index";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const authMultifactor = pgTable("auth_multifactor", {
  createdAt: timestamp("created_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
});
