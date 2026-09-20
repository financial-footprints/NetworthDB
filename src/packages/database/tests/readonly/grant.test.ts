import { describe, expect, test } from "bun:test";
import { statements } from "@database/operations/readonly/grant";

describe("readonly role statements", () => {
  test("creates role with password auth and NOBYPASSRLS", () => {
    const sql = statements("networthdb_readonly", "networthdb", "secret-pass").join("\n");

    expect(sql).toContain("CREATE USER networthdb_readonly");
    expect(sql).toContain("NOBYPASSRLS");
    expect(sql).toContain("ALTER USER networthdb_readonly WITH PASSWORD 'secret-pass'");
    expect(sql).toContain("rolname = 'rds_iam'");
    expect(sql).toContain("REVOKE rds_iam FROM networthdb_readonly");
  });

  test("escapes single quotes in passwords", () => {
    const sql = statements("networthdb_readonly", "networthdb", "pa'ss").join("\n");

    expect(sql).toContain("ALTER USER networthdb_readonly WITH PASSWORD 'pa''ss'");
  });

  test("uses allowlist grants and column lists for sensitive tables", () => {
    const sql = statements("networthdb_readonly", "networthdb", "secret-pass").join("\n");

    expect(sql).toContain('GRANT CONNECT ON DATABASE "networthdb" TO networthdb_readonly');
    expect(sql).not.toContain("GRANT SELECT ON ALL TABLES IN SCHEMA public");
    expect(sql).toContain("REVOKE SELECT ON TABLE users FROM networthdb_readonly");
    expect(sql).toContain("GRANT SELECT (");
    expect(sql).not.toMatch(/GRANT SELECT \([^)]*password_hash/);
    expect(sql).toContain("GRANT SELECT ON TABLE transactions TO networthdb_readonly");
    expect(sql).toContain("default_transaction_read_only = on");
    expect(sql).toContain("statement_timeout = '15s'");
  });

  test("enables RLS policies for tenant isolation", () => {
    const sql = statements("networthdb_readonly", "networthdb", "secret-pass").join("\n");

    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("CREATE POLICY ndb_ro_tenant");
    expect(sql).toContain("current_setting('app.user_id', true)");
    expect(sql).toContain("transaction_tag_assignments");
    expect(sql).toContain("EXISTS (");
  });
});
