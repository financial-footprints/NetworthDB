import { bytea } from "@database/schema/types";
import { ROLES } from "@ndb/core";
import {
  bigint,
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ROLES);

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
});
