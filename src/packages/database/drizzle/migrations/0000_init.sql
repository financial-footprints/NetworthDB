CREATE TYPE "public"."account_type" AS ENUM('bank', 'credit_card', 'loan', 'stocks', 'bonds', 'mutual_funds', 'unknown', 'revenue', 'expense', 'tumbler');--> statement-breakpoint
CREATE TYPE "public"."job_stage" AS ENUM('upload', 'sync', 'backup_export', 'backup_import', 'rules_apply');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'manager', 'administrator');--> statement-breakpoint
CREATE TYPE "public"."vault_slot_type" AS ENUM('password', 'recovery_phrase', 'webauthn_prf');--> statement-breakpoint
CREATE TABLE "accounts" (
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"opening_date" date NOT NULL,
	"closing_date" date,
	"account_type" "account_type" NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"bank" text NOT NULL,
	"variant" text,
	"label" text NOT NULL,
	"account_number" text NOT NULL,
	"secrets" "bytea"
);
--> statement-breakpoint
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
	"session_expires_at" timestamp NOT NULL,
	"refresh_expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"session_hash" text NOT NULL,
	"refresh_hash" text NOT NULL,
	"auth_amr" text DEFAULT 'pwd' NOT NULL,
	"auth_acr" text DEFAULT 'aal1' NOT NULL,
	CONSTRAINT "auth_sessions_session_hash_unique" UNIQUE("session_hash"),
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
CREATE TABLE "backup_exports" (
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"bytes" bigint NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"filename" text NOT NULL,
	CONSTRAINT "backup_exports_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"created_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"stage" "job_stage" NOT NULL,
	"status" "job_status" NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"job_scope_key" text NOT NULL,
	"job_scope" jsonb NOT NULL,
	"output" "bytea",
	"error" "bytea",
	"logs" "bytea"
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"user_id" uuid PRIMARY KEY NOT NULL,
	"sources_config" "bytea"
);
--> statement-breakpoint
CREATE TABLE "transaction_categories" (
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_imports" (
	"created_at" timestamp NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_rule_groups" (
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"title" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "transaction_rules" (
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"strict" boolean DEFAULT true NOT NULL,
	"stop_processing" boolean DEFAULT false NOT NULL,
	"run_on_create" boolean DEFAULT true NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"triggers" jsonb NOT NULL,
	"actions" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_tag_assignments" (
	"transaction_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "transaction_tag_assignments_transaction_id_tag_id_pk" PRIMARY KEY("transaction_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "transaction_tags" (
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"amount" bigint NOT NULL,
	"date" date NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"source_account_id" uuid NOT NULL,
	"destination_account_id" uuid NOT NULL,
	"category_id" uuid,
	"subcategory_id" uuid,
	"import_id" uuid,
	"description" text NOT NULL,
	"ref_no" text,
	CONSTRAINT "transactions_amount_positive" CHECK ("transactions"."amount" > 0),
	CONSTRAINT "transactions_source_destination_distinct" CHECK ("transactions"."source_account_id" <> "transactions"."destination_account_id"),
	CONSTRAINT "transactions_subcategory_requires_category" CHECK ("transactions"."subcategory_id" is null OR "transactions"."category_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "transactions_monthly_summary" (
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"amount_credit" bigint NOT NULL,
	"amount_debit" bigint NOT NULL,
	"amount_opening" bigint NOT NULL,
	"amount_closing" bigint NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"txn_count" integer NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	CONSTRAINT "transactions_monthly_summary_account_year_month_unique" UNIQUE("account_id","year","month")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"created_at" timestamp NOT NULL,
	"totp_confirmed_at" timestamp,
	"recovery_email_set_at" timestamp,
	"multifactor_locked_until" timestamp,
	"totp_last_step" bigint,
	"multifactor_failed_count" integer DEFAULT 0 NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"multifactor_enabled" boolean DEFAULT false NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"recovery_email_hash" text,
	"display_name" text,
	"totp_secret" "bytea",
	"totp_pending" "bytea",
	"encryption_secret" "bytea",
	"client_settings" jsonb,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "users_vault" (
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"slot_type" "vault_slot_type" NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"salt" text NOT NULL,
	"wrap_blob" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"credential_id" text
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_multifactor" ADD CONSTRAINT "auth_multifactor_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_multifactor_codes" ADD CONSTRAINT "auth_multifactor_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_recovery" ADD CONSTRAINT "auth_recovery_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_webauthn" ADD CONSTRAINT "auth_webauthn_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_webauthn_creds" ADD CONSTRAINT "auth_webauthn_creds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_exports" ADD CONSTRAINT "backup_exports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_categories" ADD CONSTRAINT "transaction_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_categories" ADD CONSTRAINT "transaction_categories_parent_id_transaction_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."transaction_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_imports" ADD CONSTRAINT "transaction_imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_imports" ADD CONSTRAINT "transaction_imports_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_rule_groups" ADD CONSTRAINT "transaction_rule_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_rules" ADD CONSTRAINT "transaction_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_rules" ADD CONSTRAINT "transaction_rules_group_id_transaction_rule_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."transaction_rule_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tag_assignments" ADD CONSTRAINT "transaction_tag_assignments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tag_assignments" ADD CONSTRAINT "transaction_tag_assignments_tag_id_transaction_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."transaction_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_source_account_id_accounts_id_fk" FOREIGN KEY ("source_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_destination_account_id_accounts_id_fk" FOREIGN KEY ("destination_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_transaction_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."transaction_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_subcategory_id_transaction_categories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."transaction_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_id_transaction_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."transaction_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions_monthly_summary" ADD CONSTRAINT "transactions_monthly_summary_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions_monthly_summary" ADD CONSTRAINT "transactions_monthly_summary_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_vault" ADD CONSTRAINT "users_vault_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_user_system_type_uidx" ON "accounts" USING btree ("user_id","account_type") WHERE "accounts"."account_type" in ('unknown', 'revenue', 'expense', 'tumbler');--> statement-breakpoint
CREATE UNIQUE INDEX "auth_multifactor_codes_user_hash_unique" ON "auth_multifactor_codes" USING btree ("user_id","code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_webauthn_creds_credential_id_unique" ON "auth_webauthn_creds" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "jobs_scope_status_idx" ON "jobs" USING btree ("user_id","stage","job_scope_key","status");--> statement-breakpoint
CREATE INDEX "transaction_categories_user_id_idx" ON "transaction_categories" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_categories_user_root_name_uidx" ON "transaction_categories" USING btree ("user_id",lower("name")) WHERE "transaction_categories"."parent_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_categories_user_child_name_uidx" ON "transaction_categories" USING btree ("user_id","parent_id",lower("name")) WHERE "transaction_categories"."parent_id" is not null;--> statement-breakpoint
CREATE INDEX "transaction_imports_account_id_idx" ON "transaction_imports" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transaction_rule_groups_user_id_idx" ON "transaction_rule_groups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transaction_rules_user_id_idx" ON "transaction_rules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transaction_rules_group_id_idx" ON "transaction_rules" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "transaction_tag_assignments_tag_id_idx" ON "transaction_tag_assignments" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "transaction_tags_user_id_idx" ON "transaction_tags" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_tags_user_name_uidx" ON "transaction_tags" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "transactions_source_date_idx" ON "transactions" USING btree ("source_account_id","date","created_at","id");--> statement-breakpoint
CREATE INDEX "transactions_destination_date_idx" ON "transactions" USING btree ("destination_account_id","date","created_at","id");--> statement-breakpoint
CREATE INDEX "transactions_user_date_idx" ON "transactions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "transactions_user_category_id_idx" ON "transactions" USING btree ("user_id","category_id");--> statement-breakpoint
CREATE INDEX "transactions_user_subcategory_id_idx" ON "transactions" USING btree ("user_id","subcategory_id");--> statement-breakpoint
CREATE INDEX "transactions_import_id_idx" ON "transactions" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "transactions_description_words_idx" ON "transactions" USING gin (string_to_array(lower("description"), ' '));--> statement-breakpoint
CREATE INDEX "transactions_ref_no_words_idx" ON "transactions" USING gin (string_to_array(lower(coalesce("ref_no", '')), ' '));--> statement-breakpoint
CREATE INDEX "transactions_monthly_summary_user_year_month_idx" ON "transactions_monthly_summary" USING btree ("user_id","year","month");--> statement-breakpoint
CREATE UNIQUE INDEX "users_vault_password_slot_unique" ON "users_vault" USING btree ("user_id") WHERE "slot_type" = 'password';--> statement-breakpoint
CREATE UNIQUE INDEX "users_vault_prf_credential_unique" ON "users_vault" USING btree ("user_id","credential_id") WHERE "slot_type" = 'webauthn_prf';