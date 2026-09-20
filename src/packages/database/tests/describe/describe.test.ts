import { describe, expect, test } from "bun:test";
import { describeDatabaseSchema } from "@database/operations/describe/describe";

describe("describeDatabaseSchema", () => {
  test("documents queryable tables only", () => {
    const schema = describeDatabaseSchema();
    const tableNames = schema.tables.map((table) => table.name).sort();

    expect(schema.overview).toContain("schema_describe");
    expect(tableNames).toEqual(
      [
        "accounts",
        "backup_exports",
        "jobs",
        "transaction_categories",
        "transaction_imports",
        "transaction_rule_groups",
        "transaction_rules",
        "transaction_tag_assignments",
        "transaction_tags",
        "transactions",
        "transactions_monthly_summary",
        "users",
      ].sort()
    );
    expect(tableNames).not.toContain("auth_sessions");
    expect(tableNames).not.toContain("sources");
    expect(tableNames).not.toContain("users_vault");
  });

  test("omits sensitive user columns", () => {
    const schema = describeDatabaseSchema();
    const users = schema.tables.find((table) => table.name === "users");

    expect(users).toBeDefined();
    expect(users?.columns.map((column) => column.name)).not.toContain("password_hash");
    expect(users?.notes?.join(" ")).toMatch(/password_hash/i);
  });

  test("includes ledger enums", () => {
    const schema = describeDatabaseSchema();
    const enumNames = schema.enums.map((entry) => entry.name);

    expect(enumNames).toEqual(
      expect.arrayContaining(["user_role", "account_type", "job_stage", "job_status"])
    );
    expect(enumNames).not.toContain("vault_slot_type");
  });
});
