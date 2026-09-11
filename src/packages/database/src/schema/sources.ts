import { bytea } from "@database/schema/types";
import { users } from "@database/schema/users/index";
import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const sources = pgTable("sources", {
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** ADR-004 tier 2: `{ sources: [...] }` JSON encrypted with per-user data key. */
  sourcesConfig: bytea("sources_config"),
});
