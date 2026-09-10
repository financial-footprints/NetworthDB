import { users } from "@database/schema/users/index";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const authWebauthn = pgTable("auth_webauthn", {
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull(),
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sessionData: text("session_data").notNull(),
});
