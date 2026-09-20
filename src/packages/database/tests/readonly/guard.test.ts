import { describe, expect, test } from "bun:test";
import { guardReadonlySql } from "@database/operations/readonly/guard";

describe("guardReadonlySql", () => {
  test("allows SELECT and WITH", () => {
    expect(guardReadonlySql("SELECT 1")).toBe("SELECT 1");
    expect(guardReadonlySql("WITH t AS (SELECT 1) SELECT * FROM t")).toContain("WITH t AS");
    expect(guardReadonlySql("EXPLAIN SELECT 1")).toBe("EXPLAIN SELECT 1");
  });

  test("strips line comments", () => {
    expect(guardReadonlySql("SELECT 1 -- drop table users")).toBe("SELECT 1");
  });

  test("rejects writes and multi-statement", () => {
    expect(() => guardReadonlySql("INSERT INTO transactions DEFAULT VALUES")).toThrow(
      "database.readonly.guard.statement-not-read-only"
    );
    expect(() => guardReadonlySql("SELECT 1; SELECT 2")).toThrow(
      "database.readonly.guard.multiple-statements"
    );
    expect(() => guardReadonlySql("SELECT 1 FOR UPDATE")).toThrow(
      "database.readonly.guard.for-update-not-allowed"
    );
  });
});
