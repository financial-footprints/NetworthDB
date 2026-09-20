import type { SchemaTableDoc } from "@database/operations/describe/index";
import { bytea } from "@database/schema/types";
import { ROLES } from "@ndb/core";
import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ROLES);

export const usersSchemaDoc: SchemaTableDoc = {
  summary: "User identity, MFA flags, and client settings (E2EE toggles).",
  omittedColumns: [
    { name: "password_hash", reason: "credential hash is not selectable" },
    { name: "recovery_email_hash", reason: "recovery email hash is not selectable" },
    { name: "totp_secret", reason: "MFA secret material is not selectable" },
    { name: "totp_pending", reason: "pending MFA material is not selectable" },
    { name: "encryption_secret", reason: "server encryption secret is not selectable" },
  ],
  columnEnums: { role: ROLES },
  jsonShapes: {
    client_settings:
      "{ e2ee?: { display_name?, account_number? }, active_period?: { preset, from?, to? }, ... }",
  },
};

export const users = pgTable("users", {
  createdAt: timestamp("created_at").notNull(),
  totpConfirmedAt: timestamp("totp_confirmed_at"),
  recoveryEmailSetAt: timestamp("recovery_email_set_at"),
  multifactorLockedUntil: timestamp("multifactor_locked_until"),
  totpLastStep: bigint("totp_last_step", { mode: "number" }),
  multifactorFailedCount: integer("multifactor_failed_count").notNull().default(0),
  role: userRoleEnum("role").notNull().default("user"),
  id: uuid("id").primaryKey(),
  multifactorEnabled: boolean("multifactor_enabled").notNull().default(false),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  recoveryEmailHash: text("recovery_email_hash"),
  displayName: text("display_name"),
  totpSecret: bytea("totp_secret"),
  totpPending: bytea("totp_pending"),
  encryptionSecret: bytea("encryption_secret"),
  clientSettings: jsonb("client_settings").$type<Record<string, unknown>>(),
});
