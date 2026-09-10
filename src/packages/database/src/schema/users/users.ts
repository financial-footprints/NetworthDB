import { bigint, boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  createdAt: timestamp("created_at").notNull(),
  totpConfirmedAt: timestamp("totp_confirmed_at"),
  recoveryEmailSetAt: timestamp("recovery_email_set_at"),
  mfaLockedUntil: timestamp("mfa_locked_until"),
  totpLastStep: bigint("totp_last_step", { mode: "number" }),
  mfaFailedCount: integer("mfa_failed_count").notNull().default(0),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  totpSecretCiphertext: text("totp_secret_ciphertext"),
  totpSecretNonce: text("totp_secret_nonce"),
  totpPendingCiphertext: text("totp_pending_ciphertext"),
  totpPendingNonce: text("totp_pending_nonce"),
  recoveryEmailHash: text("recovery_email_hash"),
  e2eeName: text("e2ee_name"),
});
