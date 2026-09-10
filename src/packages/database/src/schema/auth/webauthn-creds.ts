import { users } from "@database/schema/users/index";
import { bigint, boolean, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const authWebauthnCreds = pgTable(
  "auth_webauthn_creds",
  {
    signCount: bigint("sign_count", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at").notNull(),
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    backupEligible: boolean("backup_eligible").notNull().default(false),
    backupState: boolean("backup_state").notNull().default(false),
    attestationType: text("attestation_type").notNull(),
    transport: text("transport").notNull().default(""),
    name: text("name").notNull().default(""),
    credentialId: text("credential_id").notNull(),
    publicKey: text("public_key").notNull(),
    aaguid: text("aaguid").notNull(),
  },
  (table) => [uniqueIndex("auth_webauthn_creds_credential_id_unique").on(table.credentialId)]
);
