import { users } from "@database/schema/users/users";
import { sql } from "drizzle-orm";
import { customType, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer | null; driverParam: Buffer | null }>({
  dataType() {
    return "bytea";
  },
});

export const usersVault = pgTable(
  "users_vault",
  {
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slotType: text("slot_type").notNull(),
    salt: text("salt").notNull(),
    wrapBlob: text("wrap_blob").notNull(),
    label: text("label").notNull().default(""),
    credentialId: bytea("credential_id"),
  },
  (table) => [
    uniqueIndex("users_vault_password_slot_unique")
      .on(table.userId)
      .where(sql`${table.slotType} = 'password'`),
    uniqueIndex("users_vault_prf_credential_unique")
      .on(table.userId, table.credentialId)
      .where(sql`${table.slotType} = 'webauthn_prf'`),
  ]
);
