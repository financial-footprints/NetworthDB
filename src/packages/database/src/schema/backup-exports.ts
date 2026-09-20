import type { SchemaTableDoc } from "@database/operations/describe/index";
import { users } from "@database/schema/users/index";
import { bigint, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const backupExportsSchemaDoc: SchemaTableDoc = {
  summary:
    "Current password-protected backup ZIP metadata; one ready export per user, expires after 7 days.",
};

export const backupExports = pgTable("backup_exports", {
  createdAt: timestamp("created_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  bytes: bigint("bytes", { mode: "number" }).notNull(),
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull(),
  filename: text("filename").notNull(),
});
