CREATE TABLE "auth_credentials" (
	"sign_count" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL,
	"backup_eligible" boolean DEFAULT false NOT NULL,
	"backup_state" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"attestation_type" text NOT NULL,
	"transport" text DEFAULT '' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"credential_id" "bytea" NOT NULL,
	"public_key" "bytea" NOT NULL,
	"aaguid" "bytea" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_mfa" (
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_mfacodes" (
	"used_at" timestamp,
	"created_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"code_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_recovery" (
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"secret_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"access_expires_at" timestamp NOT NULL,
	"refresh_expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"access_hash" text NOT NULL,
	"refresh_hash" text NOT NULL,
	"auth_amr" text DEFAULT 'pwd' NOT NULL,
	"auth_acr" text DEFAULT 'aal1' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_webauthn" (
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_data" "bytea" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"created_at" timestamp NOT NULL,
	"totp_confirmed_at" timestamp,
	"recovery_email_set_at" timestamp,
	"mfa_locked_until" timestamp,
	"totp_last_step" bigint,
	"mfa_failed_count" integer DEFAULT 0 NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"srp_salt" text NOT NULL,
	"srp_verifier" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"totp_secret_ciphertext" text,
	"totp_secret_nonce" text,
	"totp_pending_ciphertext" text,
	"totp_pending_nonce" text,
	"recovery_email_hash" text,
	"e2ee_name" text
);
--> statement-breakpoint
CREATE TABLE "users_vault" (
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slot_type" text NOT NULL,
	"salt" text NOT NULL,
	"wrap_blob" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"credential_id" "bytea"
);
--> statement-breakpoint
ALTER TABLE "auth_credentials" ADD CONSTRAINT "auth_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_mfa" ADD CONSTRAINT "auth_mfa_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_mfacodes" ADD CONSTRAINT "auth_mfacodes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_recovery" ADD CONSTRAINT "auth_recovery_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_webauthn" ADD CONSTRAINT "auth_webauthn_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_vault" ADD CONSTRAINT "users_vault_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;