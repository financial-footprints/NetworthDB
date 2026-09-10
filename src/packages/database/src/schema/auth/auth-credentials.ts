import { users } from "@database/schema/users/users";
import {
  bigint,
  boolean,
  customType,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const authCredentials = pgTable(
  "auth_credentials",
  {
  signCount: bigint("sign_count", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at").notNull(),
  backupEligible: boolean("backup_eligible").notNull().default(false),
  backupState: boolean("backup_state").notNull().default(false),
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  attestationType: text("attestation_type").notNull(),
  transport: text("transport").notNull().default(""),
  name: text("name").notNull().default(""),
  credentialId: bytea("credential_id").notNull(),
  publicKey: bytea("public_key").notNull(),
  aaguid: bytea("aaguid").notNull(),
  },
  (table) => [uniqueIndex("auth_credentials_credential_id_unique").on(table.credentialId)]
);
