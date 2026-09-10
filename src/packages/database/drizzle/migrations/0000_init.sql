CREATE TABLE "auth_multifactor" (
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	CONSTRAINT "auth_multifactor_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "auth_multifactor_codes" (
	"used_at" timestamp,
	"created_at" timestamp NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_recovery" (
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"secret_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"access_expires_at" timestamp NOT NULL,
	"refresh_expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"access_hash" text NOT NULL,
	"refresh_hash" text NOT NULL,
	"auth_amr" text DEFAULT 'pwd' NOT NULL,
	"auth_acr" text DEFAULT 'aal1' NOT NULL,
	CONSTRAINT "auth_sessions_access_hash_unique" UNIQUE("access_hash"),
	CONSTRAINT "auth_sessions_refresh_hash_unique" UNIQUE("refresh_hash")
);
--> statement-breakpoint
CREATE TABLE "auth_webauthn" (
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"session_data" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_webauthn_creds" (
	"sign_count" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"backup_eligible" boolean DEFAULT false NOT NULL,
	"backup_state" boolean DEFAULT false NOT NULL,
	"attestation_type" text NOT NULL,
	"transport" text DEFAULT '' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"aaguid" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"created_at" timestamp NOT NULL,
	"totp_confirmed_at" timestamp,
	"recovery_email_set_at" timestamp,
	"multifactor_locked_until" timestamp,
	"totp_last_step" bigint,
	"multifactor_failed_count" integer DEFAULT 0 NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"multifactor_enabled" boolean DEFAULT false NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"totp_secret_ciphertext" text,
	"totp_secret_nonce" text,
	"totp_pending_ciphertext" text,
	"totp_pending_nonce" text,
	"recovery_email_hash" text,
	"e2ee_name" text,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "users_vault" (
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"slot_type" text NOT NULL,
	"salt" text NOT NULL,
	"wrap_blob" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"credential_id" text
);
--> statement-breakpoint
ALTER TABLE "auth_multifactor" ADD CONSTRAINT "auth_multifactor_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_multifactor_codes" ADD CONSTRAINT "auth_multifactor_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_recovery" ADD CONSTRAINT "auth_recovery_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_webauthn" ADD CONSTRAINT "auth_webauthn_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_webauthn_creds" ADD CONSTRAINT "auth_webauthn_creds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_vault" ADD CONSTRAINT "users_vault_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_multifactor_codes_user_hash_unique" ON "auth_multifactor_codes" USING btree ("user_id","code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_webauthn_creds_credential_id_unique" ON "auth_webauthn_creds" USING btree ("credential_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_vault_password_slot_unique" ON "users_vault" USING btree ("user_id") WHERE "slot_type" = 'password';--> statement-breakpoint
CREATE UNIQUE INDEX "users_vault_prf_credential_unique" ON "users_vault" USING btree ("user_id","credential_id") WHERE "slot_type" = 'webauthn_prf';