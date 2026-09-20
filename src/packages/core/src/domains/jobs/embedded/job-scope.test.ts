import { describe, expect, test } from "bun:test";
import { JobScope } from "@core/domains/jobs/embedded/scope";

describe("JobScope.toCanonicalJson", () => {
  test("empty scope serializes to {}", () => {
    expect(JobScope.empty().toCanonicalJson()).toBe("{}");
  });

  test("sorts keys for stable conflict index", () => {
    expect(
      JobScope.create({
        accountId: "abcd",
        financialYear: "FY23-2024",
      }).toCanonicalJson()
    ).toBe('{"account_id":"abcd","financial_year":"FY23-2024"}');
  });

  test("rule scope serializes canonical rule_id", () => {
    expect(JobScope.create({ ruleId: "rule-uuid" }).toCanonicalJson()).toBe(
      '{"rule_id":"rule-uuid"}'
    );
  });

  test("group scope serializes canonical group_id", () => {
    expect(JobScope.create({ groupId: "group-uuid" }).toCanonicalJson()).toBe(
      '{"group_id":"group-uuid"}'
    );
  });
});
