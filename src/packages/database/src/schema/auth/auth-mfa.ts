import { users } from "@database/schema/users/users";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const authMfa = pgTable("auth_mfa", {
  createdAt: timestamp("created_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
});
