import type { Pool } from "pg";

const POLICY_NAME = "ndb_ro_tenant";

const USER_ID_SETTING = `NULLIF(current_setting('app.user_id', true), '')::uuid`;

const USERS_SAFE_COLUMNS = [
  "id",
  "username",
  "role",
  "multifactor_enabled",
  "multifactor_failed_count",
  "multifactor_locked_until",
  "display_name",
  "client_settings",
  "created_at",
  "totp_confirmed_at",
  "recovery_email_set_at",
  "totp_last_step",
].join(", ");

const ACCOUNTS_SAFE_COLUMNS = [
  "created_at",
  "updated_at",
  "opening_date",
  "closing_date",
  "account_type",
  "id",
  "user_id",
  "bank",
  "variant",
  "label",
  "account_number",
].join(", ");

const JOBS_SAFE_COLUMNS = [
  "created_at",
  "completed_at",
  "stage",
  "status",
  "id",
  "user_id",
  "job_scope_key",
  "job_scope",
].join(", ");

const ALLOWLIST_TABLES = [
  "transactions",
  "transaction_imports",
  "transactions_monthly_summary",
  "transaction_categories",
  "transaction_tags",
  "transaction_rule_groups",
  "transaction_rules",
  "transaction_tag_assignments",
] as const;

function assertRoleName(roleName: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(roleName)) {
    throw new Error("database.readonly.invalid-role-name");
  }
  return roleName;
}

function quoteIdentifier(identifier: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error("database.readonly.invalid-identifier");
  }
  return `"${identifier}"`;
}

function escapePassword(password: string): string {
  return password.replace(/'/g, "''");
}

function tenantUserIdPolicy(column: string): string {
  return `${column} = ${USER_ID_SETTING}`;
}

function rlsStatements(roleName: string): string[] {
  const statements: string[] = [];

  const tablesWithUserId: Array<{ table: string; column: string }> = [
    { table: "users", column: "id" },
    { table: "accounts", column: "user_id" },
    { table: "jobs", column: "user_id" },
    { table: "transactions", column: "user_id" },
    { table: "transaction_imports", column: "user_id" },
    { table: "transactions_monthly_summary", column: "user_id" },
    { table: "transaction_categories", column: "user_id" },
    { table: "transaction_tags", column: "user_id" },
    { table: "transaction_rule_groups", column: "user_id" },
    { table: "transaction_rules", column: "user_id" },
    { table: "transaction_tag_assignments", column: "transaction_id" },
  ];

  for (const { table, column } of tablesWithUserId) {
    statements.push(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    statements.push(`DROP POLICY IF EXISTS ${POLICY_NAME} ON ${table};`);

    const using =
      table === "transaction_tag_assignments"
        ? `EXISTS (
  SELECT 1 FROM transactions t
  WHERE t.id = transaction_tag_assignments.transaction_id
    AND t.user_id = ${USER_ID_SETTING}
)`
        : tenantUserIdPolicy(column);

    statements.push(
      `CREATE POLICY ${POLICY_NAME} ON ${table} FOR SELECT TO ${roleName} USING (${using});`
    );
  }

  return statements;
}

export function statements(roleName: string, databaseName: string, password: string): string[] {
  const role = assertRoleName(roleName);
  const escapedPassword = escapePassword(password);
  const quotedDatabase = quoteIdentifier(databaseName);

  const result: string[] = [
    `
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${role}') THEN
    CREATE USER ${role}
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;
`.trim(),
    `
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'rds_iam') THEN
    REVOKE rds_iam FROM ${role};
  END IF;
END
$$;
`.trim(),
    `ALTER USER ${role} WITH PASSWORD '${escapedPassword}';`,
    `GRANT CONNECT ON DATABASE ${quotedDatabase} TO ${role};`,
    `GRANT USAGE ON SCHEMA public TO ${role};`,
    `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${role};`,
    `REVOKE SELECT ON TABLE users FROM ${role};`,
    `GRANT SELECT (${USERS_SAFE_COLUMNS}) ON users TO ${role};`,
    `REVOKE SELECT ON TABLE accounts FROM ${role};`,
    `GRANT SELECT (${ACCOUNTS_SAFE_COLUMNS}) ON accounts TO ${role};`,
    `REVOKE SELECT ON TABLE jobs FROM ${role};`,
    `GRANT SELECT (${JOBS_SAFE_COLUMNS}) ON jobs TO ${role};`,
    ...ALLOWLIST_TABLES.map((table) => `GRANT SELECT ON TABLE ${table} TO ${role};`),
    `ALTER ROLE ${role} SET default_transaction_read_only = on;`,
    `ALTER ROLE ${role} SET statement_timeout = '15s';`,
    ...rlsStatements(role),
  ];

  return result;
}

export async function grant(
  pool: Pool,
  options: {
    roleName: string;
    databaseName: string;
    password: string;
  }
): Promise<void> {
  for (const statement of statements(options.roleName, options.databaseName, options.password)) {
    await pool.query(statement);
  }
}
