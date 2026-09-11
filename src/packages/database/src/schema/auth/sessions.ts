import { users } from "@database/schema/users/index";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const authSessions = pgTable("auth_sessions", {
  sessionExpiresAt: timestamp("session_expires_at").notNull(),
  refreshExpiresAt: timestamp("refresh_expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").notNull(),
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sessionHash: text("session_hash").notNull().unique(),
  refreshHash: text("refresh_hash").notNull().unique(),
  authAmr: text("auth_amr").notNull().default("pwd"),
  authAcr: text("auth_acr").notNull().default("aal1"),
});
