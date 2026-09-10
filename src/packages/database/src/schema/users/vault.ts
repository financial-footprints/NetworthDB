import { users } from "@database/schema/users/index";
import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const usersVault = pgTable(
  "users_vault",
  {
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slotType: text("slot_type").notNull(),
    salt: text("salt").notNull(),
    wrapBlob: text("wrap_blob").notNull(),
    label: text("label").notNull().default(""),
    credentialId: text("credential_id"),
  },
  (table) => [
    uniqueIndex("users_vault_password_slot_unique")
      .on(table.userId)
      .where(sql`"slot_type" = 'password'`),
    uniqueIndex("users_vault_prf_credential_unique")
      .on(table.userId, table.credentialId)
      .where(sql`"slot_type" = 'webauthn_prf'`),
  ]
);
