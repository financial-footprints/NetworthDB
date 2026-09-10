import { users } from "@database/schema/users/users";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const authRecovery = pgTable("auth_recovery", {
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull(),
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  secretHash: text("secret_hash").notNull(),
});
