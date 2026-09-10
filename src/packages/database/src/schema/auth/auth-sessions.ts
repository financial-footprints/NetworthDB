import { users } from "@database/schema/users/users";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const authSessions = pgTable("auth_sessions", {
  accessExpiresAt: timestamp("access_expires_at").notNull(),
  refreshExpiresAt: timestamp("refresh_expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").notNull(),
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessHash: text("access_hash").notNull().unique(),
  refreshHash: text("refresh_hash").notNull().unique(),
  authAmr: text("auth_amr").notNull().default("pwd"),
  authAcr: text("auth_acr").notNull().default("aal1"),
});
